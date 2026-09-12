/* Standalone static client: no SDK, authentication, storage mutation or remote API. */
(async () => {
  const $ = id => document.getElementById(id);
  const json = async path => { const response = await fetch(path, { cache: 'no-store' }); if (!response.ok) throw new Error('快照文件暂不可用'); return response.json(); };
  const node = (tag, text) => { const item = document.createElement(tag); item.textContent = text; return item; };
  try {
    const snapshot = await json('/data/index.json');
    const valid = () => Date.now() < Date.parse(snapshot.expiresAt);
    if (!valid()) throw new Error('公开快照已过期，等待重新审核后更新。');
    $('status').textContent = `${snapshot.fixture ? '离线测试样本，禁止当作真实招生信息 · ' : ''}应急只读 · 数据审核时间 ${new Date(snapshot.reviewedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}（北京时间） · ${snapshot.count} 条。截止信息以学校官网为准。`;
    const params = new URLSearchParams(location.search);
    const route = location.pathname.split('/').filter(Boolean);
    const id = params.get('id') || (route[0] === 'notices' && route[1] !== 'detail' ? route[1] : '');
    const renderCard = row => {
      const article = node('article', ''); const title = node('a', row.schoolName + ' · ' + row.projectName);
      title.href = '/notices/' + encodeURIComponent(row.id) + '/'; article.append(title, node('p', row.departmentName + ' · ' + row.projectType + ' · 截止：' + (row.deadlineDate || '未知'))); return article;
    };
    if (id) {
      if (!snapshot.items.some(row => row.id === id)) throw new Error('通知不存在或已撤回。');
      const detail = await json('/data/' + encodeURIComponent(id) + '.json');
      if (detail.version !== snapshot.version || !valid()) throw new Error('快照版本不一致，请等待更新。');
      $('controls').hidden = true; document.querySelector('nav').hidden = true;
      const back = node('a', '返回通知列表'); back.href = '/notices/';
      $('content').append(back, renderCard(detail.item), node('pre', detail.item.requirements || '当前快照未收录正文，请核对学校来源。'));
      try { const url = new URL(detail.item.sourceLink); if (['https:','http:'].includes(url.protocol)) { const link=node('a','学校来源');link.href=url.href;link.rel='noopener noreferrer';$('content').append(link); } } catch { /* No safe source URL. */ }
    } else {
      const rows = snapshot.items;
      for (const [field, values] of [['region', rows.flatMap(r=>r.tags)], ['type', rows.map(r=>r.projectType)]]) for (const value of [...new Set(values)].sort()) { const option=node('option', value);option.value=value;$(field).append(option); }
      $('search').value = params.get('q') || ''; $('region').value=params.get('region') || ''; $('type').value=params.get('type') || ''; $('sort').value=params.get('sort') || 'publish';
      let page = Math.max(1, Number(params.get('page')) || 1), composing = false, timer;
      const draw = () => {
        if (!valid()) { $('content').replaceChildren(); $('status').textContent='快照已过期，等待重新审核后更新。'; return; }
        const keyword=$('search').value.trim().toLowerCase();
        const filtered=rows.filter(r=>[r.schoolName,r.departmentName,r.projectName,r.discipline].join(' ').toLowerCase().includes(keyword)&&(!$('region').value||r.tags.includes($('region').value))&&(!$('type').value||r.projectType===$('type').value));
        filtered.sort((a,b)=>$('sort').value==='deadline'?(a.deadlineDate||'9999').localeCompare(b.deadlineDate||'9999'):b.publishDate.localeCompare(a.publishDate));
        const pages=Math.max(1,Math.ceil(filtered.length/16));page=Math.min(page,pages);
        $('content').replaceChildren(...filtered.slice((page-1)*16,page*16).map(renderCard));
        if (!filtered.length) $('content').append(node('p','当前筛选没有公开通知。'));
        $('page').textContent=`第 ${page} / ${pages} 页，共 ${filtered.length} 条`;$('prev').disabled=page===1;$('next').disabled=page===pages;
        history.replaceState(null,'','?'+new URLSearchParams({q:$('search').value,region:$('region').value,type:$('type').value,sort:$('sort').value,page:String(page)}));
      };
      const search = () => { clearTimeout(timer); if(!composing)timer=setTimeout(()=>{page=1;draw();},350); };
      $('search').addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer);});$('search').addEventListener('compositionend',()=>{composing=false;search();});$('search').addEventListener('input',search);
      for (const field of ['region','type','sort']) $(field).addEventListener('change',()=>{page=1;draw();});
      $('prev').onclick=()=>{page--;draw();};$('next').onclick=()=>{page++;draw();};draw();
    }
    setTimeout(()=>{ $('content').replaceChildren();$('status').textContent='快照已过期，等待重新审核后更新。'; },Math.max(0,Date.parse(snapshot.expiresAt)-Date.now()));
  } catch (error) { $('content').replaceChildren();$('status').textContent=error.message; }
})();
