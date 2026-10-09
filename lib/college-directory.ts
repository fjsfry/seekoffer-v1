export type FeaturedCollege = {
  name: string;
  city: string;
  level: string[];
  groups: string[];
  focus: string;
  website: string;
  domain: string;
};

type CollegeRow = [name: string, city: string, levels: string, website: string, domain: string];

function buildFocus(name: string, city: string, levels: string[]) {
  return `${name}位于${city}，属于 ${levels.join(' / ')} 院校，点击即可直达学校官网，适合作为保研信息回访和官方核验入口。`;
}

function mapCollege([name, city, levels, website, domain]: CollegeRow): FeaturedCollege {
  const levelList = levels
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    name,
    city,
    level: levelList,
    groups: [],
    focus: buildFocus(name, city, levelList),
    website,
    domain
  };
}

const collegeRows: CollegeRow[] = [
  ['北京大学', '北京', '985,211,双一流', 'https://www.pku.edu.cn/', 'pku.edu.cn'],
  ['清华大学', '北京', '985,211,双一流', 'https://www.tsinghua.edu.cn/', 'tsinghua.edu.cn'],
  ['中国科学院大学', '北京', '双一流', 'https://www.ucas.ac.cn/', 'ucas.ac.cn'],
  ['中国人民大学', '北京', '985,211,双一流', 'https://www.ruc.edu.cn/', 'ruc.edu.cn'],
  ['北京协和医学院', '北京', '双一流', 'https://www.pumc.edu.cn/', 'pumc.edu.cn'],
  ['北京交通大学', '北京', '211,双一流', 'https://www.bjtu.edu.cn/', 'bjtu.edu.cn'],
  ['北京工业大学', '北京', '211,双一流', 'https://www.bjut.edu.cn/', 'bjut.edu.cn'],
  ['北京航空航天大学', '北京', '985,211,双一流', 'https://www.buaa.edu.cn/', 'buaa.edu.cn'],
  ['北京理工大学', '北京', '985,211,双一流', 'https://www.bit.edu.cn/', 'bit.edu.cn'],
  ['北京科技大学', '北京', '211,双一流', 'https://www.ustb.edu.cn/', 'ustb.edu.cn'],
  ['北京化工大学', '北京', '211,双一流', 'https://www.buct.edu.cn/', 'buct.edu.cn'],
  ['北京邮电大学', '北京', '211,双一流', 'https://www.bupt.edu.cn/', 'bupt.edu.cn'],
  ['中国农业大学', '北京', '985,211,双一流', 'https://www.cau.edu.cn/', 'cau.edu.cn'],
  ['北京林业大学', '北京', '211,双一流', 'https://www.bjfu.edu.cn/', 'bjfu.edu.cn'],
  ['北京中医药大学', '北京', '211,双一流', 'https://www.bucm.edu.cn/', 'bucm.edu.cn'],
  ['北京师范大学', '北京', '985,211,双一流', 'https://www.bnu.edu.cn/', 'bnu.edu.cn'],
  ['首都师范大学', '北京', '双一流', 'https://www.cnu.edu.cn/', 'cnu.edu.cn'],
  ['首都医科大学', '北京', '双一流', 'https://www.ccmu.edu.cn/', 'ccmu.edu.cn'],
  ['北京外国语大学', '北京', '211,双一流', 'https://www.bfsu.edu.cn/', 'bfsu.edu.cn'],
  ['中国传媒大学', '北京', '211,双一流', 'https://www.cuc.edu.cn/', 'cuc.edu.cn'],
  ['中央财经大学', '北京', '211,双一流', 'https://www.cufe.edu.cn/', 'cufe.edu.cn'],
  ['对外经济贸易大学', '北京', '211,双一流', 'https://www.uibe.edu.cn/', 'uibe.edu.cn'],
  ['外交学院', '北京', '双一流', 'https://www.cfau.edu.cn/', 'cfau.edu.cn'],
  ['中国政法大学', '北京', '211,双一流', 'https://www.cupl.edu.cn/', 'cupl.edu.cn'],
  ['中央民族大学', '北京', '985,211,双一流', 'https://www.muc.edu.cn/', 'muc.edu.cn'],
  ['中国音乐学院', '北京', '双一流', 'https://www.ccmusic.edu.cn/', 'ccmusic.edu.cn'],
  ['中央音乐学院', '北京', '双一流', 'https://www.ccom.edu.cn/', 'ccom.edu.cn'],
  ['中央美术学院', '北京', '双一流', 'https://www.cafa.edu.cn/', 'cafa.edu.cn'],
  ['中央戏剧学院', '北京', '双一流', 'https://www.chntheatre.edu.cn/', 'chntheatre.edu.cn'],
  ['北京体育大学', '北京', '211,双一流', 'https://www.bsu.edu.cn/', 'bsu.edu.cn'],
  ['华北电力大学', '北京', '211,双一流', 'https://www.ncepu.edu.cn/', 'ncepu.edu.cn'],
  ['中国地质大学（北京）', '北京', '211,双一流', 'https://www.cugb.edu.cn/', 'cugb.edu.cn'],
  ['中国石油大学（北京）', '北京', '211,双一流', 'https://www.cup.edu.cn/', 'cup.edu.cn'],
  ['中国人民公安大学', '北京', '双一流', 'https://www.ppsuc.edu.cn/', 'ppsuc.edu.cn'],

  ['南开大学', '天津', '985,211,双一流', 'https://www.nankai.edu.cn/', 'nankai.edu.cn'],
  ['天津大学', '天津', '985,211,双一流', 'https://www.tju.edu.cn/', 'tju.edu.cn'],
  ['天津工业大学', '天津', '双一流', 'https://www.tjpu.edu.cn/', 'tjpu.edu.cn'],
  ['天津医科大学', '天津', '211,双一流', 'https://www.tmu.edu.cn/', 'tmu.edu.cn'],
  ['天津中医药大学', '天津', '双一流', 'https://www.tjutcm.edu.cn/', 'tjutcm.edu.cn'],
  ['河北工业大学', '天津', '211,双一流', 'https://www.hebut.edu.cn/', 'hebut.edu.cn'],

  ['山西大学', '太原', '双一流', 'https://www.sxu.edu.cn/', 'sxu.edu.cn'],
  ['太原理工大学', '太原', '211,双一流', 'https://www.tyut.edu.cn/', 'tyut.edu.cn'],

  ['内蒙古大学', '呼和浩特', '211,双一流', 'https://www.imu.edu.cn/', 'imu.edu.cn'],

  ['辽宁大学', '沈阳', '211,双一流', 'https://www.lnu.edu.cn/', 'lnu.edu.cn'],
  ['大连理工大学', '大连', '985,211,双一流', 'https://www.dlut.edu.cn/', 'dlut.edu.cn'],
  ['东北大学', '沈阳', '985,211,双一流', 'https://www.neu.edu.cn/', 'neu.edu.cn'],
  ['大连海事大学', '大连', '211,双一流', 'https://www.dlmu.edu.cn/', 'dlmu.edu.cn'],

  ['吉林大学', '长春', '985,211,双一流', 'https://www.jlu.edu.cn/', 'jlu.edu.cn'],
  ['东北师范大学', '长春', '211,双一流', 'https://www.nenu.edu.cn/', 'nenu.edu.cn'],
  ['延边大学', '延吉', '211,双一流', 'https://www.ybu.edu.cn/', 'ybu.edu.cn'],

  ['哈尔滨工业大学', '哈尔滨', '985,211,双一流', 'https://www.hit.edu.cn/', 'hit.edu.cn'],
  ['哈尔滨工程大学', '哈尔滨', '211,双一流', 'https://www.hrbeu.edu.cn/', 'hrbeu.edu.cn'],
  ['东北农业大学', '哈尔滨', '211,双一流', 'https://www.neau.edu.cn/', 'neau.edu.cn'],
  ['东北林业大学', '哈尔滨', '211,双一流', 'https://www.nefu.edu.cn/', 'nefu.edu.cn'],

  ['复旦大学', '上海', '985,211,双一流', 'https://www.fudan.edu.cn/', 'fudan.edu.cn'],
  ['同济大学', '上海', '985,211,双一流', 'https://www.tongji.edu.cn/', 'tongji.edu.cn'],
  ['上海交通大学', '上海', '985,211,双一流', 'https://www.sjtu.edu.cn/', 'sjtu.edu.cn'],
  ['华东理工大学', '上海', '211,双一流', 'https://www.ecust.edu.cn/', 'ecust.edu.cn'],
  ['东华大学', '上海', '211,双一流', 'https://www.dhu.edu.cn/', 'dhu.edu.cn'],
  ['华东师范大学', '上海', '985,211,双一流', 'https://www.ecnu.edu.cn/', 'ecnu.edu.cn'],
  ['上海外国语大学', '上海', '211,双一流', 'https://www.shisu.edu.cn/', 'shisu.edu.cn'],
  ['上海财经大学', '上海', '211,双一流', 'https://www.sufe.edu.cn/', 'sufe.edu.cn'],
  ['上海大学', '上海', '211,双一流', 'https://www.shu.edu.cn/', 'shu.edu.cn'],
  ['上海海洋大学', '上海', '双一流', 'https://www.shou.edu.cn/', 'shou.edu.cn'],
  ['上海中医药大学', '上海', '双一流', 'https://www.shutcm.edu.cn/', 'shutcm.edu.cn'],
  ['上海体育大学', '上海', '双一流', 'https://www.sus.edu.cn/', 'sus.edu.cn'],
  ['上海音乐学院', '上海', '双一流', 'https://www.shcmusic.edu.cn/', 'shcmusic.edu.cn'],
  ['上海科技大学', '上海', '双一流', 'https://www.shanghaitech.edu.cn/', 'shanghaitech.edu.cn'],
  ['海军军医大学', '上海', '双一流', 'https://www.smmu.edu.cn/', 'smmu.edu.cn'],

  ['南京大学', '南京', '985,211,双一流', 'https://www.nju.edu.cn/', 'nju.edu.cn'],
  ['苏州大学', '苏州', '211,双一流', 'https://www.suda.edu.cn/', 'suda.edu.cn'],
  ['东南大学', '南京', '985,211,双一流', 'https://www.seu.edu.cn/', 'seu.edu.cn'],
  ['南京航空航天大学', '南京', '211,双一流', 'https://www.nuaa.edu.cn/', 'nuaa.edu.cn'],
  ['南京理工大学', '南京', '211,双一流', 'https://www.njust.edu.cn/', 'njust.edu.cn'],
  ['中国矿业大学', '徐州', '211,双一流', 'https://www.cumt.edu.cn/', 'cumt.edu.cn'],
  ['河海大学', '南京', '211,双一流', 'https://www.hhu.edu.cn/', 'hhu.edu.cn'],
  ['江南大学', '无锡', '211,双一流', 'https://www.jiangnan.edu.cn/', 'jiangnan.edu.cn'],
  ['南京农业大学', '南京', '211,双一流', 'https://www.njau.edu.cn/', 'njau.edu.cn'],
  ['中国药科大学', '南京', '211,双一流', 'https://www.cpu.edu.cn/', 'cpu.edu.cn'],
  ['南京师范大学', '南京', '211,双一流', 'https://www.njnu.edu.cn/', 'njnu.edu.cn'],
  ['南京邮电大学', '南京', '双一流', 'https://www.njupt.edu.cn/', 'njupt.edu.cn'],
  ['南京林业大学', '南京', '双一流', 'https://www.njfu.edu.cn/', 'njfu.edu.cn'],
  ['南京医科大学', '南京', '双一流', 'https://www.njmu.edu.cn/', 'njmu.edu.cn'],
  ['南京中医药大学', '南京', '双一流', 'https://www.njucm.edu.cn/', 'njucm.edu.cn'],
  ['南京信息工程大学', '南京', '双一流', 'https://www.nuist.edu.cn/', 'nuist.edu.cn'],

  ['浙江大学', '杭州', '985,211,双一流', 'https://www.zju.edu.cn/', 'zju.edu.cn'],
  ['宁波大学', '宁波', '双一流', 'https://www.nbu.edu.cn/', 'nbu.edu.cn'],
  ['中国美术学院', '杭州', '双一流', 'https://www.caa.edu.cn/', 'caa.edu.cn'],

  ['中国科学技术大学', '合肥', '985,211,双一流', 'https://www.ustc.edu.cn/', 'ustc.edu.cn'],
  ['合肥工业大学', '合肥', '211,双一流', 'https://www.hfut.edu.cn/', 'hfut.edu.cn'],
  ['安徽大学', '合肥', '211,双一流', 'https://www.ahu.edu.cn/', 'ahu.edu.cn'],

  ['厦门大学', '厦门', '985,211,双一流', 'https://www.xmu.edu.cn/', 'xmu.edu.cn'],
  ['福州大学', '福州', '211,双一流', 'https://www.fzu.edu.cn/', 'fzu.edu.cn'],

  ['南昌大学', '南昌', '211,双一流', 'https://www.ncu.edu.cn/', 'ncu.edu.cn'],

  ['山东大学', '济南', '985,211,双一流', 'https://www.sdu.edu.cn/', 'sdu.edu.cn'],
  ['中国海洋大学', '青岛', '985,211,双一流', 'https://www.ouc.edu.cn/', 'ouc.edu.cn'],
  ['中国石油大学（华东）', '青岛', '211,双一流', 'https://www.upc.edu.cn/', 'upc.edu.cn'],

  ['郑州大学', '郑州', '211,双一流', 'https://www.zzu.edu.cn/', 'zzu.edu.cn'],
  ['河南大学', '开封', '双一流', 'https://www.henu.edu.cn/', 'henu.edu.cn'],

  ['武汉大学', '武汉', '985,211,双一流', 'https://www.whu.edu.cn/', 'whu.edu.cn'],
  ['华中科技大学', '武汉', '985,211,双一流', 'https://www.hust.edu.cn/', 'hust.edu.cn'],
  ['中国地质大学（武汉）', '武汉', '211,双一流', 'https://www.cug.edu.cn/', 'cug.edu.cn'],
  ['武汉理工大学', '武汉', '211,双一流', 'https://www.whut.edu.cn/', 'whut.edu.cn'],
  ['华中农业大学', '武汉', '211,双一流', 'https://www.hzau.edu.cn/', 'hzau.edu.cn'],
  ['华中师范大学', '武汉', '211,双一流', 'https://www.ccnu.edu.cn/', 'ccnu.edu.cn'],
  ['中南财经政法大学', '武汉', '211,双一流', 'https://www.zuel.edu.cn/', 'zuel.edu.cn'],

  ['湖南大学', '长沙', '985,211,双一流', 'https://www.hnu.edu.cn/', 'hnu.edu.cn'],
  ['中南大学', '长沙', '985,211,双一流', 'https://www.csu.edu.cn/', 'csu.edu.cn'],
  ['湖南师范大学', '长沙', '211,双一流', 'https://www.hunnu.edu.cn/', 'hunnu.edu.cn'],
  ['湘潭大学', '湘潭', '双一流', 'https://www.xtu.edu.cn/', 'xtu.edu.cn'],
  ['国防科技大学', '长沙', '985,211,双一流', 'https://www.nudt.edu.cn/', 'nudt.edu.cn'],

  ['中山大学', '广州', '985,211,双一流', 'https://www.sysu.edu.cn/', 'sysu.edu.cn'],
  ['暨南大学', '广州', '211,双一流', 'https://www.jnu.edu.cn/', 'jnu.edu.cn'],
  ['华南理工大学', '广州', '985,211,双一流', 'https://www.scut.edu.cn/', 'scut.edu.cn'],
  ['华南师范大学', '广州', '211,双一流', 'https://www.scnu.edu.cn/', 'scnu.edu.cn'],
  ['广州中医药大学', '广州', '双一流', 'https://www.gzucm.edu.cn/', 'gzucm.edu.cn'],
  ['华南农业大学', '广州', '双一流', 'https://www.scau.edu.cn/', 'scau.edu.cn'],
  ['广州医科大学', '广州', '双一流', 'https://www.gzhmu.edu.cn/', 'gzhmu.edu.cn'],
  ['南方科技大学', '深圳', '双一流', 'https://www.sustech.edu.cn/', 'sustech.edu.cn'],

  ['广西大学', '南宁', '211,双一流', 'https://www.gxu.edu.cn/', 'gxu.edu.cn'],

  ['海南大学', '海口', '211,双一流', 'https://www.hainanu.edu.cn/', 'hainanu.edu.cn'],

  ['重庆大学', '重庆', '985,211,双一流', 'https://www.cqu.edu.cn/', 'cqu.edu.cn'],
  ['西南大学', '重庆', '211,双一流', 'https://www.swu.edu.cn/', 'swu.edu.cn'],

  ['四川大学', '成都', '985,211,双一流', 'https://www.scu.edu.cn/', 'scu.edu.cn'],
  ['西南交通大学', '成都', '211,双一流', 'https://www.swjtu.edu.cn/', 'swjtu.edu.cn'],
  ['电子科技大学', '成都', '985,211,双一流', 'https://www.uestc.edu.cn/', 'uestc.edu.cn'],
  ['西南财经大学', '成都', '211,双一流', 'https://www.swufe.edu.cn/', 'swufe.edu.cn'],
  ['四川农业大学', '成都', '211,双一流', 'https://www.sicau.edu.cn/', 'sicau.edu.cn'],
  ['西南石油大学', '成都', '双一流', 'https://www.swpu.edu.cn/', 'swpu.edu.cn'],
  ['成都理工大学', '成都', '双一流', 'https://www.cdut.edu.cn/', 'cdut.edu.cn'],
  ['成都中医药大学', '成都', '双一流', 'https://www.cdutcm.edu.cn/', 'cdutcm.edu.cn'],

  ['贵州大学', '贵阳', '211,双一流', 'https://www.gzu.edu.cn/', 'gzu.edu.cn'],

  ['云南大学', '昆明', '211,双一流', 'https://www.ynu.edu.cn/', 'ynu.edu.cn'],

  ['西藏大学', '拉萨', '211,双一流', 'https://www.utibet.edu.cn/', 'utibet.edu.cn'],

  ['西北大学', '西安', '双一流', 'https://www.nwu.edu.cn/', 'nwu.edu.cn'],
  ['西安交通大学', '西安', '985,211,双一流', 'https://www.xjtu.edu.cn/', 'xjtu.edu.cn'],
  ['西北工业大学', '西安', '985,211,双一流', 'https://www.nwpu.edu.cn/', 'nwpu.edu.cn'],
  ['西安电子科技大学', '西安', '211,双一流', 'https://www.xidian.edu.cn/', 'xidian.edu.cn'],
  ['长安大学', '西安', '211,双一流', 'https://www.chd.edu.cn/', 'chd.edu.cn'],
  ['陕西师范大学', '西安', '211,双一流', 'https://www.snnu.edu.cn/', 'snnu.edu.cn'],
  ['西北农林科技大学', '杨凌', '985,211,双一流', 'https://www.nwafu.edu.cn/', 'nwafu.edu.cn'],
  ['空军军医大学', '西安', '双一流', 'https://www.fmmu.edu.cn/', 'fmmu.edu.cn'],

  ['兰州大学', '兰州', '985,211,双一流', 'https://www.lzu.edu.cn/', 'lzu.edu.cn'],

  ['青海大学', '西宁', '211,双一流', 'https://www.qhu.edu.cn/', 'qhu.edu.cn'],

  ['宁夏大学', '银川', '211,双一流', 'https://www.nxu.edu.cn/', 'nxu.edu.cn'],

  ['新疆大学', '乌鲁木齐', '211,双一流', 'https://www.xju.edu.cn/', 'xju.edu.cn'],
  ['石河子大学', '石河子', '211,双一流', 'https://www.shzu.edu.cn/', 'shzu.edu.cn']
];

const c9Set = new Set([
  '北京大学',
  '清华大学',
  '复旦大学',
  '上海交通大学',
  '浙江大学',
  '南京大学',
  '中国科学技术大学',
  '哈尔滨工业大学',
  '西安交通大学'
]);

const huawuSet = new Set(['复旦大学', '上海交通大学', '浙江大学', '南京大学', '中国科学技术大学']);

const defenseSevenSet = new Set([
  '北京航空航天大学',
  '北京理工大学',
  '哈尔滨工业大学',
  '哈尔滨工程大学',
  '西北工业大学',
  '南京航空航天大学',
  '南京理工大学'
]);

export const collegeDirectory: FeaturedCollege[] = collegeRows.map(mapCollege).map((item) => {
  const groups = [...item.level];

  if (c9Set.has(item.name)) {
    groups.push('C9');
  }

  if (huawuSet.has(item.name)) {
    groups.push('华五');
  }

  if (defenseSevenSet.has(item.name)) {
    groups.push('国防七子');
  }

  return {
    ...item,
    groups
  };
});
