import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts/migration'))
from snapshot_convert import copy_unescape,pg_text_array,value,regex_sql,expr
from migration_errors import MigrationError
import sqlite3

class ConversionTests(unittest.TestCase):
    def test_null_empty_backslash_are_distinct(self):
        self.assertIsNone(copy_unescape(r'\N'));self.assertEqual(copy_unescape(''),'');self.assertEqual(copy_unescape(r'\\N'),r'\N')
    def test_copy_newlines_do_not_split_records(self):
        self.assertEqual(copy_unescape(r'a\tb\nc\r\\'), 'a\tb\nc\r\\')
    def test_copy_control_escapes(self):self.assertEqual(copy_unescape(r'\101\x42'),'AB')
    def test_copy_escaped_utf8_bytes(self):self.assertEqual(copy_unescape(r'\303\251\xE4\xB8\xAD'),'é中')
    def test_array_empty_null_quoted_and_escaped(self):
        self.assertEqual(pg_text_array(r'{"",NULL,"NULL","a,b","a\"b","a\\b"}'),['',None,'NULL','a,b','a"b','a\\b'])
        self.assertEqual(pg_text_array(r'{\NULL}'),['NULL'])
    def test_array_dimensions_rejected(self):
        for v in ['{{a},{b}}','[0:1]={a,b}','{a,}']:
            with self.assertRaises(MigrationError):pg_text_array(v)
    def test_int64_exact_and_range(self):
        self.assertEqual(value('9223372036854775807','int8'),9223372036854775807)
        with self.assertRaises(MigrationError):value('9223372036854775808','int8')
    def test_microsecond_time_and_offset(self):
        self.assertEqual(value('2026-09-08 16:00:00.123456+08','timestamptz'),'2026-09-08T08:00:00.123456Z')
        with self.assertRaises(MigrationError):value('2026-09-08 16:00:00','timestamptz')
    def test_json_numbers_are_not_reserialized(self):
        raw='{"large":9223372036854775807,"decimal":0.123456789123456789}'
        self.assertEqual(value(raw,'jsonb'),raw)
        with self.assertRaises(MigrationError):value('{"x":NaN}','jsonb')
    def test_unknown_sql_node_fails(self):
        with self.assertRaises(MigrationError):expr({'SubLink':{}})
    def regex_result(self,pattern,value):
        db=sqlite3.connect(':memory:')
        try:return db.execute('SELECT '+regex_sql('v',pattern)+' FROM (SELECT ? AS v)',(value,)).fetchone()[0]
        finally:db.close()
    def test_hash_regex_exact(self):
        p='^[a-f0-9]{64}$'
        for good in ['a'*64,'0123456789abcdef'*4]:self.assertEqual(self.regex_result(p,good),1)
        for bad in ['a'*63,'A'*64,'a'*63+'\n']:self.assertEqual(self.regex_result(p,bad),0)
    def test_version_regex(self):
        p=r'^[0-9]+\.[0-9]+\.[0-9]+$'
        for good in ['0.2.21','123.04.5']:self.assertEqual(self.regex_result(p,good),1)
        for bad in ['.2.21','1..2','1.2.','1.2.3.4','1.2.a']:self.assertEqual(self.regex_result(p,bad),0)
    def test_payment_url_boundaries(self):
        p='^https://jpay[.]hzjianban[.]com([/#?]|$)'
        for good in ['https://jpay.hzjianban.com','https://jpay.hzjianban.com/pay']:self.assertEqual(self.regex_result(p,good),1)
        for bad in ['https://jpay.hzjianban.com.evil','http://jpay.hzjianban.com']:self.assertEqual(self.regex_result(p,bad),0)

if __name__=='__main__':unittest.main()
