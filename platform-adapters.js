"use strict";

window.JobPlatformAdapters = (() => {
  const adapters = [
    { key:"boss", short:"B", name:"BOSS直聘", aliases:["boss","BOSS直聘"], homeUrl:"https://www.zhipin.com/web/geek/job", searchUrl:q => `https://www.zhipin.com/web/geek/job?query=${q}` },
    { key:"zhaopin", short:"智", name:"智联招聘", aliases:["zhaopin","智联招聘"], homeUrl:"https://sou.zhaopin.com/", searchUrl:q => `https://sou.zhaopin.com/?kw=${q}` },
    { key:"51job", short:"前", name:"前程无忧", aliases:["51job","前程无忧"], homeUrl:"https://www.51job.com/", searchUrl:q => `https://we.51job.com/pc/search?keyword=${q}` },
    { key:"liepin", short:"猎", name:"猎聘", aliases:["liepin","猎聘"], homeUrl:"https://www.liepin.com/zhaopin/", searchUrl:q => `https://www.liepin.com/zhaopin/?key=${q}` },
    { key:"lagou", short:"拉", name:"拉勾招聘", aliases:["lagou","拉勾","拉勾招聘"], homeUrl:"https://www.lagou.com/", searchUrl:q => `https://www.lagou.com/wn/jobs?kd=${q}` },
    { key:"nowcoder", short:"牛", name:"牛客校招", aliases:["nowcoder","牛客","牛客校招"], homeUrl:"https://www.nowcoder.com/jobs/school", searchUrl:q => `https://www.nowcoder.com/jobs/school?query=${q}` },
    { key:"yingjiesheng", short:"应", name:"应届生求职网", aliases:["yingjiesheng","应届生求职网"], homeUrl:"https://www.yingjiesheng.com/", searchUrl:q => `https://www.yingjiesheng.com/search.php?keyword=${q}` },
    { key:"iguopin", short:"国", name:"国聘", aliases:["iguopin","国聘","国资央企招聘平台"], homeUrl:"https://www.iguopin.com/job", searchUrl:q => `https://www.iguopin.com/job?keyword=${q}` },
    { key:"public", short:"公", name:"中国公共招聘网", aliases:["public","中国公共招聘网","全国事业单位招聘"], homeUrl:"https://job.mohrss.gov.cn/", searchUrl:() => "https://job.mohrss.gov.cn/cjobs/jobinfolist/listJobinfolist" },
    { key:"official", short:"官", name:"官方招聘公告", aliases:["official","官方招聘公告","国家公务员局"], homeUrl:"https://job.mohrss.gov.cn/", searchUrl:() => "https://job.mohrss.gov.cn/cjobs/institution/listInstitution" }
  ];
  function find(name) { return adapters.find(adapter => adapter.aliases.includes(name)) || adapters[0]; }
  return {
    getHomeUrl(name) { return find(name).homeUrl; },
    getSearchUrl(name, keyword) { return find(name).searchUrl(keyword); },
    names() { return adapters.map(adapter => adapter.name); },
    list() { return adapters.map(adapter => ({ ...adapter, modeLabel:"搜索跳转 + 话术复制", statusLabel:"人工确认" })); }
  };
})();
