"""Explicit PG17 AST -> SQLite/D1 schema and COPY conversion. Unknown nodes fail closed."""
from __future__ import annotations
import datetime as dt
import hashlib
import json
import re
import sqlite3
from migration_errors import MigrationError

MAIN='mnotoltpythkayguhnrk'
AUTOFILL='bqzchxacykhdmoczysfe'
def prefix(ref):
    if ref not in (MAIN,AUTOFILL):raise MigrationError('SOURCE_SCOPE')
    return 'main__' if ref==MAIN else 'autofill__'
def ident(s):
    if not re.fullmatch(r'[A-Za-z_][A-Za-z_0-9]*',s):raise MigrationError('UNSUPPORTED_IDENTIFIER')
    return '"'+s+'"'
def literal(s):return "'"+s.replace("'","''")+"'"
def names(items):return [v['String']['sval'] for v in items]
def pgtype(node):
    base=names(node['names'])[-1]
    if node.get('arrayBounds'):
        if base!='text' or len(node['arrayBounds'])!=1:raise MigrationError('UNSUPPORTED_ARRAY_TYPE')
        return '_text'
    if base not in ('uuid','text','jsonb','timestamptz','bool','int2','int4','int8','date'):raise MigrationError('UNSUPPORTED_TYPE_'+base)
    return base

def copy_unescape(s):
    if s==r'\N':return None
    out=bytearray();i=0
    while i<len(s):
        if s[i]!='\\':out.extend(s[i].encode('utf-8'));i+=1;continue
        i+=1
        if i==len(s):raise MigrationError('TRUNCATED_COPY_ESCAPE')
        ch=s[i];i+=1
        if ch in 'btnrfv\\':out.extend({'b':b'\b','t':b'\t','n':b'\n','r':b'\r','f':b'\f','v':b'\v','\\':b'\\'}[ch])
        elif ch in '01234567':
            digits=ch
            while i<len(s) and len(digits)<3 and s[i] in '01234567':digits+=s[i];i+=1
            out.append(int(digits,8))
        elif ch=='x':
            digits=''
            while i<len(s) and len(digits)<2 and s[i] in '0123456789abcdefABCDEF':digits+=s[i];i+=1
            if not digits:raise MigrationError('INVALID_COPY_HEX')
            out.append(int(digits,16))
        else:out.extend(ch.encode('utf-8'))
    try:result=out.decode('utf-8')
    except UnicodeDecodeError:raise MigrationError('INVALID_COPY_UTF8')
    if '\x00' in result:raise MigrationError('COPY_NUL_UNSUPPORTED')
    return result

def pg_text_array(s):
    if not s.startswith('{') or not s.endswith('}'):raise MigrationError('ARRAY_DIMENSIONS_UNSUPPORTED')
    if s=='{}':return []
    items=[];i=1
    while i<len(s)-1:
        quoted=s[i]=='"';value='';escaped=False
        if quoted:
            i+=1;closed=False
            while i<len(s)-1:
                c=s[i];i+=1
                if c=='"':closed=True;break
                if c=='\\':
                    if i>=len(s)-1:raise MigrationError('ARRAY_ESCAPE_INCOMPLETE')
                    c=s[i];i+=1
                value+=c
            if not closed:raise MigrationError('ARRAY_QUOTE_INCOMPLETE')
        else:
            while i<len(s)-1 and s[i]!=',':
                c=s[i];i+=1
                if c in '{}':raise MigrationError('MULTIDIMENSIONAL_ARRAY_UNSUPPORTED')
                if c=='\\':c=s[i];i+=1;escaped=True
                value+=c
            if not value:raise MigrationError('EMPTY_UNQUOTED_ARRAY_ELEMENT')
        items.append(None if not quoted and not escaped and value=='NULL' else value)
        if i<len(s)-1:
            if s[i]!=',':raise MigrationError('ARRAY_SEPARATOR_INVALID')
            i+=1
            if i==len(s)-1:raise MigrationError('ARRAY_TRAILING_COMMA')
    return items

def normalized_time(s):
    try:
        v=dt.datetime.fromisoformat(s)
        if v.tzinfo is None:raise ValueError()
        return v.astimezone(dt.timezone.utc).isoformat(timespec='microseconds').replace('+00:00','Z')
    except ValueError:raise MigrationError('UNSUPPORTED_TIMESTAMP')

def value(s,typ):
    if s is None:return None
    if typ=='bool':
        if s not in ('t','f'):raise MigrationError('INVALID_BOOLEAN')
        return 1 if s=='t' else 0
    if typ in ('int2','int4','int8'):
        if not re.fullmatch(r'-?\d+',s):raise MigrationError('INVALID_INTEGER')
        n=int(s);bits={'int2':16,'int4':32,'int8':64}[typ]
        if not -(2**(bits-1))<=n<2**(bits-1):raise MigrationError('INTEGER_RANGE')
        return n
    if typ=='uuid' and not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}',s):raise MigrationError('INVALID_UUID')
    if typ=='jsonb':
        # Validate using Python arbitrary-precision integers; preserve the original JSON text byte-for-byte.
        try:json.loads(s,parse_float=str,parse_constant=lambda _:(_ for _ in ()).throw(ValueError()))
        except ValueError:raise MigrationError('INVALID_JSON')
    if typ=='_text':return json.dumps(pg_text_array(s),ensure_ascii=False,separators=(',',':'))
    if typ=='timestamptz':return normalized_time(s)
    if typ=='date':
        try:dt.date.fromisoformat(s)
        except ValueError:raise MigrationError('INVALID_DATE')
    return s

def regex_sql(left,pattern):
    # Exact, deliberately finite translations of patterns present in these two archived schemas.
    if pattern in ('^[a-f0-9]{64}$','^[0-9a-f]{64}$'):
        return f'(length({left})=64 AND {left} NOT GLOB \'*[^0-9a-f]*\')'
    if pattern==r'^[0-9]+\.[0-9]+\.[0-9]+$':
        tail=f'substr({left},instr({left},\'.\')+1)'
        return f"({left} NOT GLOB '*[^0-9.]*' AND length({left})-length(replace({left},'.',''))=2 AND instr({left},'.')>1 AND instr({tail},'.')>1 AND substr({left},-1)<>'.')"
    formats={'^BY[0-9]{8}[A-Z0-9]{8}$':('BY',8),'^BYP[0-9]{8}[A-Z0-9]{12}$':('BYP',12),'^BYR[0-9]{8}[A-Z0-9]{12}$':('BYR',12)}
    if pattern in formats:
        lead,n=formats[pattern];i=len(lead)+1
        return f"(length({left})={len(lead)+8+n} AND substr({left},1,{len(lead)})={literal(lead)} AND substr({left},{i},8) NOT GLOB '*[^0-9]*' AND substr({left},{i+8},{n}) NOT GLOB '*[^A-Z0-9]*')"
    if pattern=='^https://jpay[.]hzjianban[.]com([/#?]|$)':
        lead='https://jpay.hzjianban.com'
        return f"(substr({left},1,{len(lead)})={literal(lead)} AND (length({left})={len(lead)} OR substr({left},{len(lead)+1},1) IN ('/','#','?')))"
    if pattern=='^https://[^[:space:]]+$':
        # Explicit Unicode whitespace rejection; at least as strict as the source URL constraint.
        whitespace=[9,10,11,12,13,32,133,160,5760,*range(8192,8203),8232,8233,8239,8287,12288]
        return '(substr('+left+",1,8)='https://' AND length("+left+')>8 AND '+' AND '.join(f'instr({left},char({n}))=0' for n in whitespace)+')'
    raise MigrationError('UNMAPPED_REGEX_PATTERN')

def const(node):
    while 'TypeCast' in node:node=node['TypeCast']['arg']
    v=node.get('A_Const',{})
    if 'sval' in v:return v['sval']['sval']
    raise MigrationError('STRING_CONSTANT_REQUIRED')

def expr(node):
    kind,x=next(iter(node.items()))
    if kind=='A_Const':
        if x.get('isnull'):return 'NULL'
        if 'sval' in x:return literal(x['sval']['sval'])
        if 'ival' in x:return str(x['ival'].get('ival',0))
        if 'boolval' in x:return '1' if x['boolval'].get('boolval',False) else '0'
        raise MigrationError('UNSUPPORTED_CONSTANT')
    if kind=='ColumnRef':return '.'.join(ident(n) for n in names(x['fields']))
    if kind=='TypeCast':
        target=names(x['typeName']['names'])[-1]
        if target=='text' and x['typeName'].get('arrayBounds'):return literal(json.dumps(pg_text_array(const(x['arg'])),ensure_ascii=False,separators=(',',':')))
        if target in ('text','jsonb','uuid'):return expr(x['arg'])
        if target in ('int2','int4','int8'):return 'CAST('+expr(x['arg'])+' AS INTEGER)'
        raise MigrationError('UNMAPPED_CAST_'+target)
    if kind=='BoolExpr':
        op={'AND_EXPR':'AND','OR_EXPR':'OR','NOT_EXPR':'NOT'}.get(x['boolop'])
        if not op:raise MigrationError('BOOL_OPERATOR')
        args=[expr(a) for a in x['args']]
        return '(NOT '+args[0]+')' if op=='NOT' else '('+(' '+op+' ').join(args)+')'
    if kind=='NullTest':return '('+expr(x['arg'])+(' IS NULL)' if x['nulltesttype']=='IS_NULL' else ' IS NOT NULL)')
    if kind=='CoalesceExpr':return 'coalesce('+','.join(expr(a) for a in x['args'])+')'
    if kind=='A_Expr':
        op='.'.join(names(x['name']));left=expr(x['lexpr'])
        if x['kind']=='AEXPR_OP_ANY' and op=='=':
            array=x['rexpr'].get('A_ArrayExpr')
            if not array:raise MigrationError('ANY_REQUIRES_LITERAL_ARRAY')
            return '('+left+' IN ('+','.join(expr(a) for a in array['elements'])+'))'
        if x['kind']!='AEXPR_OP':raise MigrationError('UNMAPPED_EXPRESSION_KIND')
        if op=='~':return regex_sql(left,const(x['rexpr']))
        if op=='->>':return '('+left+' ->> '+expr(x['rexpr'])+')'
        if op=='+' and 'TypeCast' in x['rexpr'] and names(x['rexpr']['TypeCast']['typeName']['names'])[-1]=='interval':
            interval=const(x['rexpr']['TypeCast']['arg'])
            if not re.fullmatch(r'(\d+ days?|\d\d:\d\d:\d\d)',interval):raise MigrationError('UNMAPPED_INTERVAL')
            return "strftime('%Y-%m-%dT%H:%M:%f000Z',"+left+','+literal('+'+interval)+')'
        if op not in ('=','<>','<','>','<=','>=','+','-','*','/'):raise MigrationError('UNMAPPED_OPERATOR')
        return '('+left+' '+op+' '+expr(x['rexpr'])+')'
    if kind=='FuncCall':
        name='.'.join(names(x['funcname']));args=x.get('args',[])
        if name in ('length','char_length'):return 'length('+expr(args[0])+')'
        if name=='octet_length':return 'length(CAST('+expr(args[0])+' AS BLOB))'
        if name=='jsonb_typeof':
            a=expr(args[0]);return f"(CASE json_type({a}) WHEN 'integer' THEN 'number' WHEN 'real' THEN 'number' WHEN 'text' THEN 'string' WHEN 'true' THEN 'boolean' WHEN 'false' THEN 'boolean' ELSE json_type({a}) END)"
        if name=='now':return "strftime('%Y-%m-%dT%H:%M:%f000Z','now')"
        if name=='timezone' and const(args[0]).lower()=='utc':return expr(args[1])
        if name=='gen_random_uuid':return "(lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-'||substr('89ab',abs(random()%4)+1,1)||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))))"
        raise MigrationError('UNMAPPED_FUNCTION_'+name)
    raise MigrationError('UNMAPPED_AST_'+kind)

def compile_schema(model):
    ref=model['sourceRef'];pre=prefix(ref);tables={};deferred=[];metadata=[]
    for t in model['tables']:
        name=t['relation']['relname'];cols=[];checks=[]
        for e in t['tableElts']:
            if 'ColumnDef' in e:
                c=e['ColumnDef'];typ=pgtype(c['typeName']);rules=[v['Constraint'] for v in c.get('constraints',[])]
                unsupported=[r['contype'] for r in rules if r['contype'] not in ('CONSTR_NOTNULL','CONSTR_DEFAULT')]
                if unsupported:raise MigrationError('UNMAPPED_COLUMN_CONSTRAINT')
                cols.append({'name':c['colname'],'pgType':typ,'notNull':any(r['contype']=='CONSTR_NOTNULL' for r in rules),'default':next((expr(r['raw_expr']) for r in rules if r['contype']=='CONSTR_DEFAULT'),None)})
            elif 'Constraint' in e:checks.append(e['Constraint'])
            else:raise MigrationError('UNMAPPED_TABLE_ELEMENT')
        tables[name]={'sourceRef':ref,'sourceTable':name,'targetTable':pre+name,'columns':cols,'constraints':checks,'identityColumns':[],'indexes':[],'primaryKey':[]}
    for item in model['alterTables']:
        name=item['relation']['relname']
        if name not in tables:
            # Sequence ownership has an AlterTableStmt node as well. It is separately represented by its identity owner.
            if all(c['AlterTableCmd']['subtype']=='AT_ChangeOwner' for c in item['cmds']):continue
            raise MigrationError('ALTER_UNKNOWN_TABLE')
        t=tables[name]
        for itemcmd in item['cmds']:
            c=itemcmd['AlterTableCmd'];kind=c['subtype']
            if kind=='AT_AddConstraint':t['constraints'].append(c['def']['Constraint'])
            elif kind=='AT_AddIdentity':t['identityColumns'].append(c['name'])
            elif kind=='AT_ColumnDefault':
                if c['def'].get('FuncCall',{}).get('funcname',[{}])[-1].get('String',{}).get('sval')=='nextval':t['identityColumns'].append(c['name'])
                else:raise MigrationError('ALTER_DEFAULT_UNSUPPORTED')
            elif kind in ('AT_ChangeOwner','AT_ForceRowSecurity','AT_EnableRowSecurity'):
                metadata.append({'table':name,'sourceOperation':kind,'target':'WORKER_AUTHORIZATION_REQUIRED' if 'RowSecurity' in kind else 'CLOUDFLARE_ACCOUNT_ACCESS'})
            else:raise MigrationError('UNMAPPED_ALTER_'+kind)
    auth_table=pre+'auth_subjects'
    sql=[f'CREATE TABLE {ident(auth_table)} (id TEXT PRIMARY KEY NOT NULL, created_at TEXT, email_confirmed_at TEXT, banned_until TEXT, deleted_at TEXT) STRICT;']
    for t in tables.values():
        defs=[];columnChecks=[]
        for c in t['columns']:
            typ=c['pgType'];col=ident(c['name']);dtype='INTEGER' if typ in ('int2','int4','int8','bool') else 'TEXT'
            part=col+' '+dtype+(' NOT NULL' if c['notNull'] else '')
            if c['default'] is not None:part+=' DEFAULT ('+c['default']+')'
            defs.append(part)
            if typ=='bool':columnChecks.append(f'CHECK ({col} IN (0,1))')
            if typ in ('jsonb','_text'):columnChecks.append(f'CHECK ({col} IS NULL OR json_valid({col}))')
            if typ=='_text':columnChecks.append(f"CHECK ({col} IS NULL OR json_type({col})='array')")
            if typ in ('int2','int4'):
                bits=16 if typ=='int2' else 32;columnChecks.append(f'CHECK ({col} BETWEEN {-2**(bits-1)} AND {2**(bits-1)-1})')
            if typ=='timestamptz':defs.append(ident(c['name']+'__pg_raw')+' TEXT')
        defs.extend(columnChecks)
        for c in t['constraints']:
            kind=c['contype'];label='CONSTRAINT '+ident(c['conname'])+' ' if c.get('conname') else ''
            if kind=='CONSTR_CHECK':defs.append(label+'CHECK ('+expr(c['raw_expr'])+')')
            elif kind in ('CONSTR_PRIMARY','CONSTR_UNIQUE'):
                keys=names(c['keys']);defs.append(label+('PRIMARY KEY' if kind=='CONSTR_PRIMARY' else 'UNIQUE')+' ('+','.join(ident(k) for k in keys)+')')
                if kind=='CONSTR_PRIMARY':t['primaryKey']=keys
            elif kind=='CONSTR_FOREIGN':
                target=c['pktable'];targetName=auth_table if target['schemaname']=='auth' and target['relname']=='users' else pre+target['relname'] if target['schemaname']=='public' else None
                if not targetName:raise MigrationError('UNMAPPED_FOREIGN_SCHEMA')
                actions={'a':'NO ACTION','r':'RESTRICT','c':'CASCADE','n':'SET NULL','d':'SET DEFAULT'}
                defs.append(label+'FOREIGN KEY ('+','.join(ident(k) for k in names(c['fk_attrs']))+') REFERENCES '+ident(targetName)+' ('+','.join(ident(k) for k in names(c['pk_attrs']))+') ON DELETE '+actions[c['fk_del_action']]+' ON UPDATE '+actions[c['fk_upd_action']]+' DEFERRABLE INITIALLY DEFERRED')
                t.setdefault('dependencies',[]).append(targetName)
            else:raise MigrationError('UNMAPPED_CONSTRAINT_'+kind)
        if not t['primaryKey']:raise MigrationError('NO_PRIMARY_KEY')
        # INTEGER PRIMARY KEY provides SQLite's atomic generated IDs for all source bigint identity/sequence owners.
        if t['identityColumns'] and t['identityColumns']!=t['primaryKey']:raise MigrationError('NON_PRIMARY_IDENTITY_UNSUPPORTED')
        sql.append('CREATE TABLE '+ident(t['targetTable'])+' (\n  '+',\n  '.join(defs)+'\n) STRICT;')
    for index in model['indexes']:
        if index['accessMethod']!='btree' or index.get('indexIncludingParams') or index.get('nulls_not_distinct'):raise MigrationError('INDEX_METHOD_UNSUPPORTED')
        items=[]
        for e in index['indexParams']:
            e=e['IndexElem']
            if e.get('opclass') or e.get('collation') or e['nulls_ordering']!='SORTBY_NULLS_DEFAULT':raise MigrationError('INDEX_SEMANTICS_UNSUPPORTED')
            items.append((ident(e['name']) if e.get('name') else expr(e['expr']))+(' DESC' if e['ordering']=='SORTBY_DESC' else ''))
        name=index['relation']['relname'];statement='CREATE '+('UNIQUE ' if index.get('unique') else '')+'INDEX '+ident(pre+index['idxname'])+' ON '+ident(pre+name)+' ('+','.join(items)+')'
        if index.get('whereClause'):statement+=' WHERE '+expr(index['whereClause'])
        sql.append(statement+';');tables[name]['indexes'].append({'name':pre+index['idxname'],'unique':bool(index.get('unique')),'sql':statement+';'})
    return '\n\n'.join(sql),tables,metadata

def parse_copy(data,expected_counts):
    tables={};current=None
    for line in data.split('\n'):
        line=line.removesuffix('\r')
        if current:
            if line==r'\.':current=None;continue
            fields=line.split('\t')
            if len(fields)!=len(tables[current]['columns']):raise MigrationError('COPY_FIELD_COUNT')
            tables[current]['rows'].append([copy_unescape(v) for v in fields])
        elif line.startswith('COPY '):
            m=re.fullmatch(r'COPY ([a-z_][a-z_0-9]*\.[a-z_][a-z_0-9]*) \(([^)]+)\) FROM stdin;',line)
            if not m:raise MigrationError('COPY_HEADER_UNSUPPORTED')
            current=m[1]
            if current in tables:raise MigrationError('DUPLICATE_COPY_SECTION')
            tables[current]={'columns':[x.strip().strip('"') for x in m[2].split(',')],'rows':[]}
    if current:raise MigrationError('TRUNCATED_COPY_SECTION')
    if set(tables)!=set(expected_counts):raise MigrationError('COPY_TABLE_SET_MISMATCH')
    for name,t in tables.items():
        if len(t['rows'])!=expected_counts[name]['rows']:raise MigrationError('COPY_ROW_COUNT_MISMATCH')
    return tables

def canonical_rows(rows):
    return json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode('utf-8')

def convert_tables(ref,tables,copies):
    result=[];pre=prefix(ref)
    auth=copies['auth.users'];wanted=['id','created_at','email_confirmed_at','banned_until','deleted_at']
    indices=[auth['columns'].index(c) for c in wanted]
    auth_rows=[[r[i] for i in indices] for r in auth['rows']]
    result.append({'sourceRef':ref,'sourceTable':'auth.users identity projection only','targetTable':pre+'auth_subjects','columns':wanted,'columnTypes':['uuid','timestamptz','timestamptz','timestamptz','timestamptz'],'primaryKey':['id'],'rows':auth_rows,'dependencies':[]})
    for name,t in tables.items():
        copy=copies['public.'+name]
        if copy['columns']!=[c['name'] for c in t['columns']]:raise MigrationError('SCHEMA_COPY_COLUMN_ORDER_MISMATCH')
        targetCols=[c['name'] for c in t['columns']]+[c['name']+'__pg_raw' for c in t['columns'] if c['pgType']=='timestamptz']
        types=[c['pgType'] for c in t['columns']]+['text' for c in t['columns'] if c['pgType']=='timestamptz']
        rows=[];maximum=0
        for row in copy['rows']:
            output=[value(v,c['pgType']) for v,c in zip(row,t['columns'])]+[v for v,c in zip(row,t['columns']) if c['pgType']=='timestamptz']
            length=sum(len(str(v).encode('utf-8')) for v in output if v is not None)
            maximum=max(maximum,length)
            if length>1_900_000:raise MigrationError('ROW_SIZE_REQUIRES_SPLIT_'+name)
            rows.append(output)
        t['targetColumns']=targetCols;t['maxRowBytes']=maximum
        result.append({'sourceRef':ref,'sourceTable':'public.'+name,'targetTable':t['targetTable'],'columns':targetCols,'columnTypes':types,'primaryKey':t['primaryKey'],'rows':rows,'dependencies':t.get('dependencies',[])})
    for table in result:
        positions=[table['columns'].index(k) for k in table['primaryKey']]
        table['rows'].sort(key=lambda r:tuple((v is not None,v) for v in (r[i] for i in positions)))
        keys=[tuple(r[i] for i in positions) for r in table['rows']]
        if len(set(keys))!=len(keys) or any(any(v is None for v in k) for k in keys):raise MigrationError('PRIMARY_KEY_CONFLICT')
        table['sha256']=hashlib.sha256(canonical_rows(table['rows'])).hexdigest()
    return result

def validate_local(schema,tables):
    db=sqlite3.connect(':memory:');db.execute('PRAGMA foreign_keys=ON');db.execute('PRAGMA temp_store=MEMORY')
    try:
        try:db.executescript(schema)
        except sqlite3.Error as e:
            message=str(e)
            category=message if re.fullmatch(r'[A-Za-z0-9_ :.,"()\-]+',message) else type(e).__name__
            raise MigrationError('SCHEMA_SQLITE_ERROR_'+category)
        db.execute('BEGIN');db.execute('PRAGMA defer_foreign_keys=ON')
        for t in tables:
            sql='INSERT INTO '+ident(t['targetTable'])+' ('+','.join(ident(c) for c in t['columns'])+') VALUES ('+','.join('?' for _ in t['columns'])+')'
            try:db.executemany(sql,t['rows'])
            except sqlite3.Error as e:raise MigrationError('LOCAL_INSERT_'+t['targetTable']+'_'+type(e).__name__)
        violations=db.execute('PRAGMA foreign_key_check').fetchall()
        if violations:raise MigrationError('FOREIGN_KEY_VIOLATIONS_'+str(len(violations)))
        db.commit()
        for t in tables:
            rows=db.execute('SELECT '+','.join(ident(c) for c in t['columns'])+' FROM '+ident(t['targetTable'])).fetchall()
            positions=[t['columns'].index(k) for k in t['primaryKey']]
            rows.sort(key=lambda r:tuple((v is not None,v) for v in (r[i] for i in positions)))
            if hashlib.sha256(canonical_rows(rows)).hexdigest()!=t['sha256']:raise MigrationError('LOCAL_READBACK_HASH_MISMATCH')
        if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise MigrationError('SQLITE_INTEGRITY_FAILED')
        return {'tables':len(tables),'rows':sum(len(t['rows']) for t in tables),'foreignKeyCheck':'PASSED','allRowsReadbackHash':'PASSED','integrityCheck':'ok','restoredSupabase':'NOT_PERFORMED'}
    finally:db.close()
