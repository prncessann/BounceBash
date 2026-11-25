'use strict';

(async () => {
  const article = document.querySelector('[data-blog-article]');
  const lists = document.querySelectorAll('[data-blog-list]');
  const slug = article?.dataset.blogArticle || new URLSearchParams(location.search).get('slug');
  const element = (tag, text, className) => {
    const node=document.createElement(tag);
    if(text) node.textContent=text;
    if(className) node.className=className;
    return node;
  };
  const image = (url, alt, cls) => {
    const node=element('img',null,cls);
    if(/^(?:\.\.\/|\/)assets\/[\w-]+(?:\/[\w-]+)*\.(?:png|webp|jpe?g)$/i.test(url))node.src=url;
    node.alt=alt||'';
    return node;
  };
  const fetchJSON=async url=>{
    const response=await fetch(url);
    if(!response.ok)throw new Error(response.status===404?'This article is unavailable.':'Articles could not be loaded. Please refresh.');
    return response.json();
  };
  function block(value){
    if(typeof value==='string')return document.createTextNode(value);
    if(!['p','h2','h3','h4','ul','ol','li','strong','em','b','i','a','div','span','blockquote','br','figure','figcaption','img'].includes(value.tag))return document.createTextNode('');
    const out=value.tag==='img'?image(value.attrs?.src,value.attrs?.alt,value.attrs?.class):element(value.tag,null,value.attrs?.class);
    if(value.tag==='a'&&/^[\w-]+\.html$/.test(value.attrs?.href))out.href=value.attrs.href;
    out.append(...(value.children||[]).map(block));
    return out;
  }
  if(article)try{
    if(!slug)throw new Error('This article is unavailable.');
    const {article:record}=await fetchJSON('/api/articles/'+encodeURIComponent(slug));
    document.title=record.title+' – Bounce Bash PH';
    const header=element('header',null,'post-header');
    const back=element('a','← Back to all posts','back-link');back.href='blog.html';
    header.append(back,element('p',record.category,'eyebrow'),element('h1',record.title),element('p',record.summary,'lead'),element('p',record.date_label,'post-meta'));
    const body=element('div',null,'post-body');body.append(...record.blocks.map(block));
    article.replaceChildren(header);
    if(record.image)article.append(image(record.image,record.image_alt,'post-hero'));
    article.append(body);
  }catch(error){article.textContent=error.message;}
  if(lists.length)try{
    const {articles}=await fetchJSON('/api/articles');
    for(const list of lists){
      const records=articles.filter(item=>item.slug!==slug).slice(0,Number(list.dataset.blogLimit)||articles.length);
      list.replaceChildren(...records.map(item=>{
        const link=element('a',null,'blog-card');link.href=item.url;
        if(item.image)link.append(image(item.image,item.image_alt));
        link.append(element('p',item.category,'cat'),element('h3',item.title),element('p',item.date_label,'post-meta'),element('span','Read more →','read-more'));
        return link;
      }));
      if(!records.length)list.textContent='No published articles yet.';
    }
  }catch(error){for(const list of lists)list.textContent=error.message;}
})();

