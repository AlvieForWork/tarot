// 試玩版解讀引擎：沒有 AI 時，用回答＋抽到的牌組出解讀。
// 之後接上 Claude 時，輸出格式維持一樣，畫面不用改。
//
// 每一道「菜」（TOPICS）包含：菜單上的文字、要問的題目、牌陣、解讀方式。
// 選項的 r ＝ 選下去時塔羅師在紙條上回的一句話。

const cardText = d => (d.rev ? d.card.rv : d.card.up).t;
const cardE = d => (d.rev ? d.card.rv : d.card.up).e;
const cardLook = d => (d.rev ? d.card.rv : d.card.up).l || '';
const cardGist = d => (d.rev ? d.card.rv : d.card.up).g || '';
const cardName = d => d.card.zh + (d.rev ? '（逆位）' : '');
const tone = (e, good, bad, mid) => (e >= 1 ? good : e <= -1 ? bad : mid);
const MONTHS = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];

/* ================================================================
   一、要不要換工作？（二選一牌陣）
   ================================================================ */
const YEARS = {
  lt1:  { label: '未滿一年', r: '才剛開始就累了。', line: '才不到一年就有這種感覺，不代表你不夠能吃苦，有時候是第一眼就對不上。' },
  y1_3: { label: '1～3 年', r: '新鮮感差不多退了。', line: '' },
  y3_5: { label: '3～5 年', r: '這個年資，最容易卡。', line: '待到這個年資會卡，很常見：學得差不多了，下一步卻看不到。' },
  gt5:  { label: '5 年以上', r: '待這麼久，不容易。', line: '待了這麼久，要離開不只是換工作，也是跟一部分的自己告別。' },
};
const UNHAPPY = {
  people:  { label: '人（主管、同事）', r: '人的問題最磨人。', line: '你不開心的，比較多是「人」，不是工作本身。每天要面對的那幾個人，正在把你喜歡的部分也一起磨掉。' },
  content: { label: '工作內容沒熱情', r: '提不起勁，裝不來的。', line: '你不是不夠努力，是這份工作已經沒辦法讓你在意了。' },
  pay:     { label: '薪水不夠', r: '這個很實際。', line: '你很清楚自己值多少，只是這裡沒有給到。' },
  future:  { label: '看不到未來', r: '往前看是一片霧。', line: '最讓你累的不是現在，是往後看，看不到自己在這裡的樣子。' },
  tired:   { label: '身體或心太累', r: '身體不會說謊。', line: '你的身體和心已經在替你說話了。' },
  unsure:  { label: '說不上來，就是不想去', r: '說不上來的，通常最準。', line: '說不上來為什麼，但每天早上就是不想出門。這種感覺，通常比講得出來的理由更準。' },
};
const DEST = {
  same:    { label: '同一行，換一家', r: '行業沒錯，是地方不對。' },
  switch:  { label: '轉行，做別的', r: '想換一條路走。' },
  rest:    { label: '先休息一陣子', r: '先喘口氣，也是一種方向。' },
  unknown: { label: '還不知道', r: '不知道也沒關係，牌會說。' },
};
const FEAR = {
  worse:  { label: '換了更糟', r: '怕踩空，很正常。', line: '你最怕的是換了更糟。所以今天不憑感覺，把兩條路並排攤開來看。' },
  money:  { label: '收入不穩', r: '錢的事，不能不想。', line: '你怕的是收入斷掉。這很實際，等一下的步驟我會把這件事放在最前面。' },
  age:    { label: '年紀或資歷不夠', r: '你比自己以為的有本錢。', line: '你擔心自己的年紀或資歷不夠。先記得：會這樣擔心的人，通常比自己以為的更有本錢。' },
  family: { label: '讓家人失望', r: '你很在意他們。', line: '你怕讓家人失望。但這份工作是你每天在過的，不是他們。' },
  waste:  { label: '浪費之前的努力', r: '努力不會憑空消失。', line: '你怕之前的努力白費。努力不會因為換地方就消失，它會跟著你走。' },
};

function buildSwitch(a, draws) {
  const name = a.name || '你';
  const stay = draws.slice(0, 3), leave = draws.slice(3, 6);
  const u = a.unhappy;
  const intro = [
    `${name}，我先說我聽到的。`,
    ...u.slice(0, 2).map(k => UNHAPPY[k].line),
    YEARS[a.years].line,
    FEAR[a.fear].line,
  ].filter(Boolean);

  const POS = ['現況', '會遇到', '三個月後'];
  const U_NOUN = { people: '人', content: '工作本身提不起勁', pay: '薪水', future: '看不到未來', tired: '身體和心都太累', unsure: '那種說不上來的不想去' };
  const F_NOUN = { worse: '換了更糟', money: '收入不穩', age: '年紀或資歷不夠', family: '讓家人失望', waste: '之前的努力白費' };
  const tie = (d, i) => {
    const e = cardE(d);
    if (i === 0) return `你說最讓你不開心的是${U_NOUN[u[0]]}。` + tone(e, '但這張牌說，這裡沒有你想的那麼糟。', '這張牌說的就是它。', '這件事不會自己變好，也不會馬上變壞。');
    if (i === 4) return `如果你${{ same: '換到同一行的另一家', switch: '轉行', rest: '先休息一陣子', unknown: '先走再說' }[a.dest]}，` + tone(e, '會比你想的順。', '這就是你會先撞到的牆。', '要邊走邊調整。');
    if (i === 5) return `你最怕${F_NOUN[a.fear]}。` + tone(e, '這張牌說，三個月後這件事沒有發生。', '這個擔心有一部分是對的，所以要先準備好。', '三個月後還不會有定論，但你會比現在清楚。');
    return '';
  };
  const cards = draws.map((d, i) => ({ group: i < 3 ? '留下' : '離開', pos: POS[i % 3], text: cardText(d) + tie(d, i), draw: d }));

  const score = row => cardE(row[0]) + cardE(row[1]) + cardE(row[2]) * 1.5;
  const s = score(stay);
  let l = score(leave);
  if (u.includes('future')) l += 1.5;
  if (u.includes('content')) l += 1.5;
  if (u.includes('people')) l += 1;
  if (u.includes('tired')) l += 0.5;
  if (u.includes('unsure')) l += 0.5;
  const goLeave = l > s || (l === s && (u.includes('future') || u.includes('content')));

  const key = goLeave ? leave[2] : stay[2];
  const verdict = goLeave
    ? {
        headline: '離開',
        reason: `「離開」那條路的最後一張是${cardName(key)}：${key.card.kw}。` +
          (u.includes('future') || u.includes('content')
            ? '再加上你說的不開心，是換個主管、換個座位都解決不了的事。'
            : u.includes('people')
              ? '讓你累的是人，而人是可以換的。這次要挑的是環境，不只是職缺。'
              : '牌面很清楚：你在外面的路，比留在這裡順。'),
      }
    : {
        headline: '先留下',
        reason: `「留下」那條路的最後一張是${cardName(key)}：${key.card.kw}。` +
          '這裡還有你沒用完的空間。但留下不是原地不動，接下來三個月，你要主動去改一件事。',
      };

  let steps;
  if (goLeave) {
    steps = [
      a.fear === 'money'
        ? '第一個月：先把數字算清楚。存到至少 6 個月的生活費，再談離開。'
        : '第一個月：更新履歷，投 3 份讓你有點心動的職缺，看看市場怎麼回應你。',
      {
        same: '第二個月：去面試。重點放在「這裡的人和節奏是不是你要的」，不要只比薪水。',
        switch: '第二個月：找兩個在你想去的領域工作的人聊聊，問他們每天實際在做什麼。',
        rest: '第二個月：替休息期訂一個結束日。有終點的休息，才不會變成焦慮。',
        unknown: '第二個月：每週記下一件「做起來不累的事」。方向會從這張清單裡浮出來。',
      }[a.dest],
      '第三個月：手上有確定的下一步，再遞辭呈。不要在還沒準備好的時候用力關門。',
    ];
  } else {
    steps = [
      u.includes('people') ? '第一個月：找一個你信任的人，把讓你卡住的那件事說出來，不要再自己吞。'
        : u.includes('pay') ? '第一個月：整理這一年的成果，準備好談加薪的理由和數字。'
        : u.includes('tired') ? '第一個月：先把時間拿回來。下班後的訊息，可以明天再回。'
        : '第一個月：在現在的工作裡，找一件可以主動爭取的新任務。',
      '第二個月：觀察那件事有沒有被回應。有回應，代表這裡還有空間。',
      '第三個月：如果什麼都沒有變，那就是答案了。回來找我，我們重新看牌。',
    ];
  }

  return {
    intro, cards, free: [0, 3], rest: [1, 2, 4, 5], verdict, steps,
    closing: goLeave
      ? '三個月後，如果你手上有一份讓你猶豫的新工作，代表現在這裡還有你捨不得的東西。那時候再回來找我。'
      : '留下不是認輸。給這裡三個月，也給自己三個月。',
  };
}

/* ================================================================
   二、我適合什麼工作？（天賦牌陣）
   ================================================================ */
const STATUS = {
  work:     { label: '在上班', r: '邊上班邊想，很辛苦。', line: '' },
  jobless:  { label: '剛離職，正在找', r: '空檔期，正好看清楚。', line: '現在沒有工作，剛好是看清楚方向的時候。' },
  student:  { label: '學生、快畢業', r: '現在試錯，成本最低。', line: '還沒正式進職場，現在試錯的成本最低。' },
  freelance:{ label: '接案、自由工作', r: '自由的滋味你嚐過了。', line: '接案的你，已經知道自由的滋味了。' },
  home:     { label: '在家照顧家人', r: '這也是一份全職工作。', line: '你現在在家照顧家人，那本身就是一份全職的工作。' },
};
// 做什麼會忘記時間 → 天賦；j ＝ 適合的工作，t ＝ 這份工作的特性（拿來對照「最受不了」）
const TALENT = {
  plan:     { label: '把亂七八糟的事排整齊', r: '你是讓事情動起來的人。', stamp: '規劃', title: '把複雜的事情理出順序',
              line: '你看到亂糟糟的東西，會忍不住想把它排好。',
              jobs: [{ n: '專案管理' }, { n: '營運企劃' }, { n: '活動統籌', t: 'crowd' }, { n: '行政管理', t: 'repeat' }] },
  people:   { label: '跟人聊天、幫上別人', r: '別人會想找你說話。', stamp: '助人', title: '跟人站在一起、幫上別人',
              line: '別人有困難的時候，常常第一個想到你。',
              jobs: [{ n: '顧客成功', t: 'crowd' }, { n: '人資', t: 'crowd' }, { n: '講師、教學', t: 'crowd' }, { n: '諮詢顧問' }, { n: '業務', t: 'unstable' }] },
  make:     { label: '動手把東西做出來', r: '做出來才算數，對吧。', stamp: '實作', title: '把東西親手做出來',
              line: '比起討論，你更想直接做做看。',
              jobs: [{ n: '工程開發' }, { n: '設計製作' }, { n: '餐飲烘焙', t: 'crowd' }, { n: '手作品牌', t: 'unstable' }] },
  idea:     { label: '想點子、創作', r: '腦袋停不下來的那種。', stamp: '創作', title: '把想法變成作品',
              line: '你腦袋裡一直有新的東西在跑。',
              jobs: [{ n: '設計' }, { n: '內容企劃' }, { n: '行銷企劃' }, { n: '影像創作', t: 'unstable' }] },
  research: { label: '研究、查資料、找答案', r: '你會一路查到底。', stamp: '研究', title: '把事情搞清楚、找出答案',
              line: '你會想知道「為什麼」，而且會一路查到底。',
              jobs: [{ n: '數據分析' }, { n: '研究員' }, { n: '品質管理', t: 'repeat' }, { n: '財務分析' }] },
  lead:     { label: '帶大家往前走', r: '卡住的時候你會站出來。', stamp: '帶領', title: '帶著一群人把事情推出去',
              line: '事情卡住的時候，你會忍不住站出來。',
              jobs: [{ n: '團隊主管', t: 'crowd' }, { n: '產品經理' }, { n: '專案負責人' }, { n: '創業', t: 'unstable' }] },
};
const AVOID = {
  managed:  { label: '一直被盯、被管', r: '你需要的是信任。', line: '你最受不了被一直盯著。你需要的是信任，不是監督。' },
  crowd:    { label: '整天跟人打交道', r: '你需要安靜的時間。', line: '整天跟人周旋會把你掏空，你需要安靜做事的時間。' },
  repeat:   { label: '每天重複一樣的事', r: '一成不變會讓你枯掉。', line: '每天一樣的事會讓你枯掉，你需要變化。' },
  noresult: { label: '做完看不到成果', r: '努力要有回音。', line: '看不到成果的努力，最讓你洩氣。' },
  unstable: { label: '收入不穩定', r: '這不是膽小，是清楚。', line: '收入不穩會讓你沒辦法專心。這不是膽小，是清楚自己。' },
};
const VALUE = {
  money:   { label: '穩定的收入', r: '很實在。' },
  growth:  { label: '一直在進步', r: '你不想原地踏步。' },
  freedom: { label: '自己決定怎麼做', r: '自由對你很重要。' },
  meaning: { label: '做的事有意義', r: '你要的是值得。' },
  praise:  { label: '被看見、被肯定', r: '想被看見，一點都不丟臉。' },
};

function buildTalent(a, draws) {
  const name = a.name || '你';
  const POS = ['天賦', '熱情', '阻礙', '方向'];
  const TPL = [
    ['這是你本來就有的東西。你用得太自然，常常覺得「這有什麼」。', '你的天賦被壓住了。不是沒有，是這陣子沒有地方用。', '你的天賦還在醒來，需要一點機會才看得出來。'],
    ['讓你有熱情的事很清楚，順著它走就對了。', '你的熱情最近被消耗掉了。先休息，熱情才會回來。', '熱情需要被重新點燃，從小事開始試。'],
    ['阻礙其實不大，多半是你自己想太多。', '卡住你的就是這個。它比你以為的更大，要正面處理。', '阻礙存在，但可以繞過去。'],
    ['方向是開的。現在動，會比之後動更順。', '方向還有霧。先小步試，不要一次押上全部。', '方向慢慢在成形，邊走邊確認。'],
  ];
  const TIE = [
    e => `你說「${TALENT[a.love[0]].label}」會讓你忘記時間，` + tone(e, '這就是證據。', '那個感覺還在，只是最近很少有機會用到。', '就從這裡開始找。'),
    e => `你最在意的是「${VALUE[a.value].label}」，` + tone(e, '有它的地方，你就點得起來。', '熱情被消耗，多半是因為最近一直得不到它。', '先從它比較多的事情開始試。'),
    e => `你說最受不了「${AVOID[a.avoid].label}」，` + tone(e, '只要避開它，這個阻礙就不大。', '你現在的卡，很可能就是它造成的。', '挑工作的時候，把它當成第一道篩子。'),
    () => ({ work: '你還在上班，可以邊做邊試，不用先辭職。', jobless: '空檔期正好拿來小規模試做，不用急著找下一份。', student: '趁還是學生，多試幾種，不用一次選定。', freelance: '你已經在接案，可以直接把新方向放進作品裡試。', home: '你現在在家，可以先用零碎的時間試，不用一次回到全職。' })[a.status],
  ];
  const cards = draws.map((d, i) => ({
    group: i < 2 ? '你' : '路', pos: POS[i],
    text: cardGist(d) + tone(cardE(d), ...TPL[i]) + TIE[i](cardE(d)),
    draw: d,
  }));

  const L = a.love;
  const main = TALENT[L.length > 1 && cardE(draws[1]) > cardE(draws[0]) ? L[1] : L[0]];
  const second = L.length > 1 ? TALENT[L.find(k => TALENT[k] !== main)] : null;
  const jobs = [...main.jobs, ...(second ? second.jobs : [])].filter(j => j.t !== a.avoid).map(j => j.n);
  const pickJobs = [...new Set(jobs)].slice(0, 3);

  const intro = [
    `${name}，我先說我聽到的。`,
    ...L.map(k => TALENT[k].line),
    AVOID[a.avoid].line,
    `你最在意的是「${VALUE[a.value].label}」。`,
    STATUS[a.status].line,
  ].filter(Boolean);

  const verdict = {
    headline: main.stamp,
    reason: `你說做「${main.label}」的時候會忘記時間，「天賦」的位置又抽到${cardName(draws[0])}。` +
      `最適合你的，是${main.title}的工作` + (second ? `，再帶一點${second.stamp}的成分。` : '。') +
      `可以先看看：${pickJobs.join('、')}。` +
      `挑公司的時候，把「${VALUE[a.value].label}」放在第一位。`,
  };

  const job = pickJobs[0];
  const steps = [
    `第一個月：找一個跟「${job}」有關的小任務試做。可以是公司裡的，也可以是自己的小專案。`,
    `第二個月：找一位正在做${job}的人聊 30 分鐘，問他最累和最開心的是什麼。`,
    {
      work: '第三個月：做完前兩步還是很有感覺，就開始投這個方向的職缺。',
      jobless: '第三個月：把試做的成果整理成作品，帶著它去面試。',
      student: '第三個月：找一個相關的實習或打工，用身體確認一次。',
      freelance: '第三個月：把這個方向放進你的服務清單，看市場買不買單。',
      home: '第三個月：用你有的零碎時間，先從兼職或接案試這個方向。',
    }[a.status],
  ];

  return {
    intro, cards, free: [0, 1], rest: [2, 3], verdict, steps,
    closing: `天賦不會跑掉，只是在等你用它。三個月後，帶著你試做的東西回來找我。`,
  };
}

/* ================================================================
   三、什麼時候跳槽？（時間牌陣）
   ================================================================ */
const READY = {
  none:      { label: '還沒開始找', r: '心已經先往外走了。', line: '你還沒開始找，但已經在想「什麼時候走」，代表心其實已經往外了。' },
  looking:   { label: '在看職缺了', r: '在等一個時機。', line: '你已經在看職缺了，只是還在等一個時機。' },
  interview: { label: '正在面試', r: '只差一個決定。', line: '你已經在面試了，現在缺的是一個決定的時間點。' },
  offer:     { label: '已經拿到 offer', r: '機會在手上了。', line: '你手上已經有機會，現在只差「什麼時候說出口」。' },
};
const SAVINGS = {
  lt3:  { label: '撐不到 3 個月', r: '這會影響時間點。', line: '存款撐不到三個月，這件事會影響時間點。' },
  m3_6: { label: '3～6 個月', r: '有一點空間。', line: '存款撐得了幾個月，你有一點選擇的空間。' },
  gt6:  { label: '半年以上', r: '你比很多人自由。', line: '存款夠，你比很多人自由。' },
};
const PENDING = {
  bonus:   { label: '在等年終', r: '年終是你應得的。', line: '你在等年終。那是你應得的，不用不好意思。' },
  project: { label: '有專案還沒收尾', r: '你是會收尾的人。', line: '你手上還有專案沒收尾，你是不想留爛攤子給別人的人。' },
  none:    { label: '沒有，隨時可以走', r: '沒有牽掛，很好。', line: '' },
};
const URGENCY = {
  ok:   { label: '還撐得住', r: '那就不急，挑對的時候。', line: '' },
  hard: { label: '有點撐不住了', r: '我聽到了。', line: '你說有點撐不住了，我聽到了。' },
  pain: { label: '每天都很痛苦', r: '那你比時間重要。', line: '每天都很痛苦的話，時間就不是最重要的事，你才是。' },
};

function nextMonths(now = new Date()) {
  return [1, 2, 3].map(k => { const m = (now.getMonth() + k) % 12; return { n: m + 1, zh: MONTHS[m] }; });
}

function buildTiming(a, draws) {
  const name = a.name || '你';
  const ms = nextMonths();
  const monthTie = i => {
    if (a.pending === 'bonus' && [11, 12, 1].includes(ms[i].n)) return '年終還沒入袋，這個月可以先準備、先面試，離職等拿到再說。';
    if (i !== 0) return '';
    if (a.urgency === 'pain') return '你說每天都很痛苦，這個月就算還不走，也先把離開的準備做起來。';
    if (a.savings === 'lt3') return '存款還撐不久，這個月先多存一點，替自己留退路。';
    if (a.pending === 'project') return '手上的專案，這個月先收到一個段落。';
    return '';
  };
  const READY_TIE = { none: '你還沒開始找，先別急著跟同事說你想走。', looking: '在看職缺的這段時間，別讓現在的工作先垮掉。', interview: '面試的時候記得，你也在挑他們。', offer: '手上的 offer，回覆前把合約再讀一次。' };
  const cards = draws.map((d, i) => i < 3
    ? { group: '月份', pos: ms[i].zh, draw: d,
        text: cardGist(d) + tone(cardE(d), '這個月順，適合主動出擊：投履歷、談條件。', '這個月有阻力，先別急著動，把力氣放在準備上。', '這個月平平，適合默默準備。') + monthTie(i) }
    : { group: '提醒', pos: '要注意', draw: d,
        text: cardGist(d) + tone(cardE(d), '你的運氣不錯，但記得把話說清楚再走，好聚好散。', '小心衝動。離職信寫好先放一晚，隔天再送。', '不要只看薪水。面試時多問一句「團隊現在最大的問題是什麼」。') + READY_TIE[a.ready] });

  const score = ms.map((m, i) => {
    let s = cardE(draws[i]);
    if (a.savings === 'lt3') s += i * 0.8;
    if (a.ready === 'none') s += i * 0.8;
    if (a.ready === 'looking') s += i * 0.3;
    if (a.ready === 'interview' && i === 0) s += 1;
    if (a.ready === 'offer' && i === 0) s += 2;
    if (a.pending === 'project' && i === 0) s -= 1.5;
    if (a.urgency === 'pain' && i === 0) s += 1.5;
    if (a.urgency === 'hard' && i === 0) s += 0.7;
    return s;
  });
  // 在等年終：台灣年終多半在春節前（一月左右）發，十一月到一月一律不選
  const beforeBonus = m => a.pending === 'bonus' && [11, 12, 1].includes(m.n);
  const allowed = ms.map((m, i) => i).filter(i => !beforeBonus(ms[i]));
  const best = allowed.length
    ? allowed.reduce((b, i) => (score[i] > score[b] ? i : b), allowed[0])
    : ms.length - 1;
  const T = allowed.length ? ms[best].zh : '二月';

  const intro = [
    `${name}，我先說我聽到的。`,
    READY[a.ready].line, SAVINGS[a.savings].line, PENDING[a.pending].line, URGENCY[a.urgency].line,
  ].filter(Boolean);

  const why = [];
  if (!allowed.length) why.push('這三個月年終都還沒進來。不急，等年終入帳，二月再走。');
  else if (ms.slice(0, best).some(beforeBonus)) why.push('年終拿到手再走，不用白白放掉。');
  if (a.ready === 'offer' && best === 0) why.push('機會已經在你手上，不需要等太久。');
  if (a.savings === 'lt3' && best > 0) why.push('存款還撐不久，多給自己一點時間準備，是對的。');
  if (a.urgency === 'pain' && best === 0) why.push('你已經很痛苦了，不要再拖。');
  const verdict = {
    headline: T,
    reason: (allowed.length ? `「${T}」抽到${cardName(draws[best])}：${draws[best].card.kw}。三個月裡，這個月最順。` : '') + why.join(''),
  };

  const steps = [
    `${T}之前：` + {
      none: '更新履歷，先列出三家想去的公司。',
      looking: '每週固定投 3 份。不要一次投一堆，再一次全部放棄。',
      interview: '把每一場面試被問到的問題記下來，下一場會比上一場好。',
      offer: '確認 offer 的細節：薪資、試用期、到職日，白紙黑字寫清楚。',
    }[a.ready],
    a.pending === 'bonus' ? '年終入帳之前，不要先說要走。'
      : a.savings === 'lt3' ? '同時開始存錢，目標是至少 3 個月的生活費。'
      : '把手上的工作整理成交接清單，走的時候才乾淨。',
    `${T}：遞辭呈，把交接期抓好，通常是一個月。好聚好散，這一行比你想的小。`,
  ];

  return {
    intro, cards, free: [0, 3], rest: [1, 2], verdict, steps,
    closing: `${T}過後，回來告訴我你在哪裡。`,
  };
}

/* ================================================================
   四、要不要放下一切，去做想做的事？
   ================================================================ */
const LEAP_WHAT = {
  abroad:  { label: '去國外生活', r: '換一片天空。', line: '你想去國外生活，換一個地方重新開始。', place: '國外' },
  startup: { label: '自己創業', r: '想替自己做事。', line: '你想自己做點什麼，不再替別人做。', place: '創業' },
  switch:  { label: '轉行，做一直想做的事', r: '那件事一直在心裡。', line: '你想轉去做一直想做的事。', place: '那個新的行業' },
  rest:    { label: '先停下來，什麼都不做', r: '你需要的是停一下。', line: '你想先停下來，什麼都不做一陣子。', place: '休息' },
};
const LEAP_LONG = {
  new:   { label: '最近才冒出來', r: '剛冒出來的，先看看。', line: '這個念頭最近才冒出來。' },
  year:  { label: '一年左右', r: '想了一年，不是隨便說說。', line: '這個念頭跟了你一年左右。' },
  years: { label: '好幾年了', r: '好幾年，它都沒有走。', line: '這個念頭已經跟了你好幾年，它沒有走。' },
};
const LEAP_BLOCK = {
  money:  { label: '錢不夠', r: '錢是真的問題。', line: '最卡你的是錢，這很實際。' },
  age:    { label: '年紀', r: '你還沒放棄。', line: '你擔心年紀。但會這樣想，代表你還沒放棄。' },
  family: { label: '家人', r: '你放不下他們。', line: '你放不下家人的眼光，也放不下他們。' },
  fail:   { label: '怕失敗、回不來', r: '怕，是因為在乎。', line: '你怕失敗，怕去了之後回不來。' },
  attach: { label: '放不下現在擁有的', r: '那些得來不易。', line: '你放不下現在擁有的，那些得來不易。' },
};
const LEAP_WANT = {
  free:    { label: '自由', r: '你想要自己決定。', line: '你想要的是自由。' },
  newself: { label: '一個新的自己', r: '想遇見不一樣的你。', line: '你想遇見一個新的自己。' },
  escape:  { label: '離開現在的生活', r: '嗯。這個我記下了。', line: '你最想要的，是離開現在的生活。' },
  dream:   { label: '完成一直想做的事', r: '那是你的夢。', line: '你想完成一件一直想做的事。' },
};

function buildLeap(a, draws) {
  const name = a.name || '你';
  const POS = ['真正想要的', '卡住你的', '出發之後', '一年後'];
  const TPL = [
    ['你心裡要的東西很清楚，這不是一時衝動。', '你要的東西還有點模糊。小心把「想逃開」當成「想去」。', '你要的東西還在成形，慢慢會更清楚。'],
    ['阻礙比你想的小，多半是想像出來的。', '這個阻礙是真的，出發前一定要先處理。', '阻礙存在，但有辦法繞過去。'],
    ['出發之後，你會比現在更像自己。', '剛出發的時候會很辛苦，要有心理準備。', '出發之後有好有壞，差別在你怎麼過。'],
    ['一年後回頭看，你會慶幸自己走了這一步。', '一年後，可能會發現問題跟著你一起走了。', '一年後的你，會比現在更清楚自己要什麼。'],
  ];
  const TIE = [
    e => `你說最想要的是「${LEAP_WANT[a.want].label}」，` + tone(e, '牌是站在你這邊的。', '這張牌要你再問自己一次。', '這個答案還會變得更具體。'),
    () => `你說最卡你的是「${LEAP_BLOCK[a.block].label}」。` + {
      money: '錢的事算得出來，算出來就沒那麼可怕。',
      age: '年紀很少是真正的問題，問題是你還要等多久。',
      family: '家人的擔心，多半來自還不了解你的計畫。',
      fail: '你怕回不來，但大部分的路，都留著回頭的方向。',
      attach: '放不下的東西裡，有些其實可以帶著走。',
    }[a.block],
    () => ({ abroad: '到了國外，語言、住處和錢，會是最先考驗你的三件事。', startup: '創業之後，最先考驗你的會是現金流，和自己的紀律。', switch: '轉行之後，最先考驗你的，是從新手重新開始的那種落差。', rest: '停下來之後，最先考驗你的，是什麼都不做的那種不安。' })[a.what],
    () => ({ new: '這個念頭才剛冒出來，一年後它還在不在，本身就是答案。', year: '這個念頭跟了你一年，再過一年，你會想知道自己有沒有試過。', years: '這個念頭已經跟了你好幾年。再過一年，它還是會在。' })[a.howlong],
  ];
  const cards = draws.map((d, i) => ({ group: i < 2 ? '心' : '路', pos: POS[i], text: cardGist(d) + tone(cardE(d), ...TPL[i]) + TIE[i](cardE(d)), draw: d }));

  let score = cardE(draws[2]) + cardE(draws[3]) * 1.5 + Math.min(0, cardE(draws[1])) * 0.5;
  score += { new: -1, year: 0.5, years: 1.5 }[a.howlong];
  score += { free: 0.5, newself: 0.5, escape: -1.5, dream: 1 }[a.want];
  if (a.block === 'money') score -= 1;
  const go = score >= 0.5;
  const W = LEAP_WHAT[a.what];
  const key = draws[3];
  const escape = a.want === 'escape';

  const intro = [
    `${name}，我先說我聽到的。`,
    W.line, LEAP_LONG[a.howlong].line, LEAP_BLOCK[a.block].line, LEAP_WANT[a.want].line,
  ];

  const verdict = go
    ? {
        headline: '出發',
        reason: `「一年後」抽到${cardName(key)}：${key.card.kw}。` +
          (a.howlong === 'years' ? '這個念頭跟了你好幾年，它不會自己消失。' : '') +
          (a.want === 'dream' ? '這是你一直想做的事，不是一時衝動。' : '') +
          (escape ? '但出發前先想清楚：你是想去那裡，還是想離開這裡？兩種都可以，只是準備的方式不一樣。' : '去吧，但要帶著計畫去。'),
      }
    : {
        headline: '再等等',
        reason: `「一年後」抽到${cardName(key)}：${key.card.kw}。` +
          (escape ? `我直說：你想去的，可能不是${W.place}，是想離開現在的生活。先把讓你想逃的那件事處理掉，再決定要不要走。`
            : a.howlong === 'new' ? '這個念頭才剛出現，給它三個月，看它還在不在。'
            : a.block === 'money' ? '錢還不夠，現在衝出去會很辛苦。先存一筆出發基金。'
            : '不是不去。是現在出發，你會帶著一堆還沒解決的事一起走。'),
      };

  const BLOCK_STEP = {
    money: '第二個月：開一個獨立帳戶當出發基金，每個月固定存一筆。',
    family: '第二個月：找一個好時機跟家人說。帶著計畫說，不要帶著情緒說。',
    age: '第二個月：找一個跟你年紀差不多、已經做過這件事的人聊一聊。',
    fail: '第二個月：寫下最壞的情況，和你的退路。寫下來，它就沒那麼可怕。',
    attach: '第二個月：把放不下的東西列出來，分成「帶得走」和「帶不走」。',
  };
  const steps = go
    ? [
        {
          abroad: '第一個月：查清楚簽證、打工度假的條件，算出至少要準備多少錢。',
          startup: '第一個月：先用下班時間做出最小的版本，看有沒有人願意付錢。',
          switch: '第一個月：報一堂新領域的課，或接一個小案子試試看。',
          rest: '第一個月：替休息訂好時間和預算：休多久、花多少。',
        }[a.what],
        BLOCK_STEP[a.block],
        '第三個月：訂一個出發日，寫在月曆上。有了日期，夢想才會變成計畫。',
      ]
    : [
        escape ? '第一個月：寫下現在最想逃開的三件事，看看有沒有不用離開也能改變的。'
          : '第一個月：照常過日子，但每週記下一次「好想去」的時刻。',
        a.block === 'money' ? BLOCK_STEP.money
          : a.what === 'abroad' ? '第二個月：先去一趟短的，一週也好，用身體確認是不是真的喜歡。'
          : '第二個月：用週末小規模試做，先不要辭職。',
        '第三個月：如果那個念頭還在，而且更清楚了，回來找我，我們重新看牌。',
      ];

  return {
    intro, cards, free: [0, 1], rest: [2, 3], verdict, steps,
    closing: go ? '去吧。到了那裡，記得寄一張明信片給我。' : '不是不去，是時候還沒到。三個月後，回來找我。',
  };
}

/* ================================================================
   五、要不要回職場？（在家顧小孩、照顧家人、休息了一陣子的人）
   ================================================================ */
const BACK_AWAY = {
  lt1:  { label: '不到一年', r: '職場的感覺都還在。', line: '你離開還不到一年。' },
  y1_3: { label: '1～3 年', r: '有一段時間了。', line: '你離開職場一到三年了。' },
  gt3:  { label: '3 年以上', r: '那段時間你一直在忙別的。', line: '你離開職場三年以上了，那段時間你一直在忙別的事。' },
};
const BACK_WHY = {
  kids:    { label: '照顧小孩', r: '那是全職的工作。', line: '你當初離開，是為了照顧小孩。那本身就是一份全職的工作。' },
  family:  { label: '照顧家人', r: '你把家人放在前面。', line: '你當初離開，是為了照顧家人。' },
  burnout: { label: '太累了，需要休息', r: '身體先喊停了。', line: '你當初離開，是因為太累了，身體先喊了停。' },
  other:   { label: '工作沒了，或其他原因', r: '不是你選的，也沒關係。', line: '當初離開不完全是你選的，這不代表什麼。' },
};
const BACK_PULL = {
  money:     { label: '家裡需要多一份收入', r: '很實際的理由。', line: '想回去，最大的原因是家裡需要多一份收入。' },
  self:      { label: '想找回自己的生活', r: '你也是你自己。', line: '想回去，最大的原因是想找回自己的生活。' },
  bored:     { label: '在家悶壞了', r: '你需要一個出口。', line: '想回去，是因為在家真的悶壞了。' },
  fear:      { label: '怕離開太久回不去', r: '這個擔心很真實。', line: '你怕再不回去，就回不去了。' },
  notreally: { label: '其實還好，是別人一直問', r: '嗯，我聽到了。', line: '老實說，一直問你什麼時候回去的，是別人。' },
};
const BACK_BLOCK = {
  kids:   { label: '孩子或家人沒人顧', r: '這是第一件要安排的事。', n: '孩子或家人沒人顧' },
  gap:    { label: '空白太久，跟不上', r: '會回來的，比你想的快。', n: '空白太久、跟不上' },
  time:   { label: '時間不自由', r: '時間是你最缺的。', n: '時間不自由' },
  family: { label: '家人（公婆、另一半）的意見', r: '這個很常見。', n: '家人的意見' },
  none:   { label: '沒特別擔心，就是還沒決定', r: '那就看牌怎麼說。', n: '' },
};
const BACK_FORM = {
  full: { label: '全職，認真回去', r: '要回就認真回。', n: '全職' },
  part: { label: '兼職或彈性工時', r: '先從一半開始。', n: '兼職或彈性工時' },
  free: { label: '在家接案', r: '時間抓在自己手上。', n: '在家接案' },
  new:  { label: '換一個全新的方向', r: '重新開始也是一種回去。', n: '一個全新的方向' },
};

function buildBack(a, draws) {
  const name = a.name || '你';
  const POS = ['現在的你', '心裡的聲音', '回去之後', '半年後'];
  const TPL = [
    ['你現在的狀態不錯，比你以為的更準備好了。', '你現在很累，先照顧好自己，比什麼都重要。', '你現在在一個中間的位置，還在找自己的節奏。'],
    ['你心裡其實已經想回去了。', '你心裡有一個聲音還在猶豫，不要假裝沒聽見。', '你心裡的答案還沒成形，再給它一點時間。'],
    ['回去之後，會比你想的更快上手。', '回去的頭幾個月會很辛苦，工作和家裡會互相拉扯。', '回去之後有好有壞，最重要的是家裡的分工先談好。'],
    ['半年後回頭看，你會慶幸自己回去了。', '半年後，你可能會發現自己兩邊都在硬撐。', '半年後的你，會更清楚自己要什麼樣的生活。'],
  ];
  const TIE = [
    () => ({ lt1: '你離開還不到一年，職場的感覺都還在。', y1_3: '你離開了一段時間，很多東西還記得，只是需要暖身。', gt3: '你離開三年以上了。空白不是缺點，那段時間你在別的地方很忙。' })[a.away],
    e => a.pull === 'notreally'
      ? '你說其實還好，是別人一直在問。' + tone(e, '但這張牌說，你心裡可能比你承認的更想動一動。', '這張牌同意你：現在還不是你自己想要的時候。', '先分清楚，哪些是你的聲音，哪些是別人的。')
      : `你說想回去，最大的原因是「${BACK_PULL[a.pull].label}」。` + tone(e, '這是真心的。', '這張牌要你再確認一次，這個原因是不是你自己的。', '這個原因還會變得更清楚。'),
    () => BACK_BLOCK[a.block].n ? `你最擔心${BACK_BLOCK[a.block].n}。` + {
      kids: '回去之前，接送和照顧一定要先安排好。',
      gap: '技能會回來的，比你想的快。',
      time: '找工作的時候，把「時間彈性」放在條件第一位。',
      family: '家人的意見要聽，但最後要過這種生活的是你。',
    }[a.block] : '',
    () => ({ full: '如果是全職，前半年是最辛苦、也最關鍵的一段。', part: '如果先從兼職開始，半年後你會知道要不要再多一點。', free: '如果是在家接案，半年後你會知道它能不能撐起一份收入。', new: '如果是換一個新方向，半年剛好是看見第一個成果的時間。' })[a.form],
  ];
  const cards = draws.map((d, i) => ({ group: i < 2 ? '你' : '路', pos: POS[i], text: cardGist(d) + tone(cardE(d), ...TPL[i]) + TIE[i](cardE(d)), draw: d }));

  let score = cardE(draws[2]) + cardE(draws[3]) * 1.5 + Math.min(0, cardE(draws[1])) * 0.5;
  score += { money: 1, self: 1.5, bored: 1, fear: 0.5, notreally: -2.5 }[a.pull];
  if (a.why === 'burnout' && a.away === 'lt1') score -= 1;
  if (a.block === 'kids') score -= 0.5;
  const go = score >= 0.5;
  const key = draws[3];
  const F = BACK_FORM[a.form];

  const intro = [
    `${name}，我先說我聽到的。`,
    BACK_WHY[a.why].line, BACK_AWAY[a.away].line, BACK_PULL[a.pull].line,
  ];

  const verdict = go
    ? {
        headline: '回去',
        reason: `「半年後」抽到${cardName(key)}：${key.card.kw}。` + {
          money: '家裡需要這份收入，這是很實際的理由，不用覺得不好意思。',
          self: '你想回去，不只是為了錢，是想找回自己。這個理由就夠了。',
          bored: '在家悶壞了，代表你的力氣需要一個出口。',
          fear: '你怕再等就回不去。這個擔心是對的，越早開始越容易。',
          notreally: '',
        }[a.pull] + `先從${F.n}開始。`,
      }
    : {
        headline: '再等等',
        reason: `「半年後」抽到${cardName(key)}：${key.card.kw}。` +
          (a.pull === 'notreally' ? '我直說：想要你回去的，好像不是你，是問你的人。等你自己想回去的那天，再回去。'
            : a.why === 'burnout' && a.away === 'lt1' ? '你當初是累到離開的，休息還不到一年。身體還沒說好之前，先不要急。'
            : a.block === 'kids' ? '孩子和家裡的照顧還沒安排好。先把這件事安排好，回去才走得久。'
            : '不是不回去。是現在回去，你會一邊上班一邊擔心家裡，兩邊都顧不好。先把準備做好。'),
      };

  const PREP = {
    kids: '先把孩子和家人的照顧安排好：誰接送、生病時誰請假，先講好。',
    gap: '更新履歷。空白的那幾年照實寫，寫你在那段時間做了什麼。',
    time: '算清楚你每天真正能工作的時段，再去找符合的職缺。',
    family: '先跟另一半談好分工，再跟家裡其他人說。帶著計畫說，不要帶著情緒說。',
    none: '更新履歷，投三份讓你有點心動的職缺。',
  };
  const steps = go
    ? [
        '第一個月：' + PREP[a.block],
        {
          full: '第二個月：去面試。問清楚加班的狀況和請假制度，這些比薪水更重要。',
          part: '第二個月：找兼職或彈性工時的職缺，也可以問問以前的同事和主管。',
          free: '第二個月：先接一個小案子，就算便宜也沒關係，先讓自己動起來。',
          new: '第二個月：報一堂新領域的課，或找一個正在做這行的人聊聊。',
        }[a.form],
        '第三個月：給自己訂一個開始的日期。剛回去的第一個月一定會累，那很正常，不代表你選錯。',
      ]
    : [
        a.pull === 'notreally' ? '第一個月：下次有人問你什麼時候回去，可以只回一句「我還在想」。'
          : a.why === 'burnout' ? '第一個月：好好休息，不用拿別人的進度來逼自己。'
          : '第一個月：' + PREP[a.block],
        '第二個月：每週留兩個小時給自己，做一件跟家裡無關的事。',
        '第三個月：如果想回去的念頭越來越清楚，回來找我，我們重新看牌。',
      ];

  return {
    intro, cards, free: [0, 1], rest: [2, 3], verdict, steps,
    closing: go ? '回去之後，也要記得照顧你自己。三個月後，回來跟我說說。' : '不是不回去，是還沒到時候。等你自己想回去的那天，回來找我。',
  };
}

/* ================================================================
   菜單
   ================================================================ */
// 自由填寫題：沒有接 AI 前讀不懂使用者寫的字，先不放進問事單（11/19 拿掉）
const NOTE_Q = (ph) => ({ key: 'note', type: 'area', label: '其他想說的', hint: '可以不填', say: '最後，還有什麼想讓我知道的？', ph, next: '填好了', skip: '沒有了，直接開始' });

const TOPICS = {
  switch: {
    title: '要不要換工作？', desc: '把「留下」和「離開」並排攤開，給你一個答案。', price: 99,
    rows: [{ tag: '留下', pos: ['現況', '會遇到', '三個月後'] }, { tag: '離開', cls: 'alt', pos: ['現況', '會遇到', '三個月後'] }],
    qs: [
      { key: 'years', type: 'one', label: '這份工作做了多久', say: a => `${a.name}，這份工作做多久了？`, opts: YEARS },
      { key: 'unhappy', type: 'multi', max: 2, label: '最不開心的是', hint: '最多勾兩個', say: '在那裡，最讓你不開心的是什麼？', opts: UNHAPPY },
      { key: 'dest', type: 'one', label: '如果離開，想去', say: '如果真的走，心裡想去哪？', opts: DEST },
      { key: 'fear', type: 'one', label: '最怕的是', say: '嗯。那你最怕什麼？', opts: FEAR },
    ],
    shuffleSay: '在心裡把你的狀況說一遍，最後問：「我該留下，還是離開？」想好了，按住牌。',
    lock: ['兩條路各自會遇到什麼、三個月後的樣子', '他的答案：留下，還是離開', '接下來三個月，每個月做一件事'],
    build: buildSwitch,
  },
  talent: {
    title: '我適合什麼工作？', desc: '看你的天賦和熱情，指一個方向給你。', price: 99,
    rows: [{ tag: '你', pos: ['天賦', '熱情'] }, { tag: '路', cls: 'alt', pos: ['阻礙', '方向'] }],
    qs: [
      { key: 'status', type: 'one', label: '你現在的狀態', say: a => `${a.name}，你現在在做什麼？`, opts: STATUS },
      { key: 'love', type: 'multi', max: 2, label: '做什麼會忘記時間', hint: '最多勾兩個', say: '做什麼事的時候，你會忘記時間？', opts: TALENT },
      { key: 'avoid', type: 'one', label: '最受不了的是', say: '反過來，你最受不了什麼？', opts: AVOID },
      { key: 'value', type: 'one', label: '工作裡最在意的', say: '如果只能選一個，工作給你什麼最重要？', opts: VALUE },
    ],
    shuffleSay: '在心裡把你喜歡做的事想一遍，最後問：「我適合做什麼？」想好了，按住牌。',
    lock: ['擋在你前面的是什麼、方向往哪裡', '他的答案：最適合你的工作類型', '接下來三個月，怎麼試水溫'],
    build: buildTalent,
  },
  timing: {
    title: '什麼時候跳槽？', desc: '接下來三個月，哪一個月最適合走。', price: 99,
    rows: [{ tag: '月份', pos: () => nextMonths().map(m => m.zh) }, { tag: '提醒', cls: 'alt', pos: ['要注意'] }],
    qs: [
      { key: 'ready', type: 'one', label: '準備到哪裡了', say: a => `${a.name}，找工作準備到哪了？`, opts: READY },
      { key: 'savings', type: 'one', label: '存款能撐多久', say: '老實說，存款能撐幾個月？', opts: SAVINGS },
      { key: 'pending', type: 'one', label: '有沒有在等什麼', say: '手上有沒有還在等的東西？', opts: PENDING },
      { key: 'urgency', type: 'one', label: '現在的心情', say: '現在每天去上班，感覺怎麼樣？', opts: URGENCY },
    ],
    shuffleSay: '在心裡把你的狀況說一遍，最後問：「我什麼時候該走？」想好了，按住牌。',
    lock: ['其他兩個月的牌', '他的答案：哪一個月最適合走', '從現在到那個月，該做的三件事'],
    build: buildTiming,
  },
  leap: {
    title: '要不要放下一切，去做想做的事？', desc: '去國外、創業、轉行，那一步該不該跨出去。', price: 99,
    rows: [{ tag: '心', pos: ['真正想要的', '卡住你的'] }, { tag: '路', cls: 'alt', pos: ['出發之後', '一年後'] }],
    qs: [
      { key: 'what', type: 'one', label: '想放下一切去做什麼', say: a => `${a.name}，你想放下一切，去做什麼？`, opts: LEAP_WHAT },
      { key: 'howlong', type: 'one', label: '這個念頭多久了', say: '這個念頭，跟了你多久？', opts: LEAP_LONG },
      { key: 'block', type: 'one', label: '最卡住你的', say: '是什麼讓你到現在還沒走？', opts: LEAP_BLOCK },
      { key: 'want', type: 'one', label: '去了之後最想得到', say: '如果真的去了，你最想得到什麼？', opts: LEAP_WANT },
    ],
    shuffleSay: '想著那件你一直想做的事，在心裡問：「我該不該出發？」想好了，按住牌。',
    lock: ['出發之後會怎樣、一年後的你', '他的答案：出發，還是再等等', '接下來三個月，該做的三件事'],
    build: buildLeap,
  },
  back: {
    title: '要不要回職場？', desc: '在家顧小孩、照顧家人，或休息了一陣子，要不要回去上班。', price: 99,
    rows: [{ tag: '你', pos: ['現在的你', '心裡的聲音'] }, { tag: '路', cls: 'alt', pos: ['回去之後', '半年後'] }],
    qs: [
      { key: 'why', type: 'one', label: '當初為什麼離開', say: a => `${a.name}，當初為什麼離開職場？`, opts: BACK_WHY },
      { key: 'away', type: 'one', label: '離開多久了', say: '離開多久了？', opts: BACK_AWAY },
      { key: 'pull', type: 'one', label: '想回去最大的原因', say: '現在想回去，最大的原因是什麼？', opts: BACK_PULL },
      { key: 'block', type: 'one', label: '最擔心的', say: '說到回去，你最擔心什麼？', opts: BACK_BLOCK },
      { key: 'form', type: 'one', label: '想用什麼方式回去', say: '如果回去，你想怎麼回去？', opts: BACK_FORM },
    ],
    shuffleSay: '在心裡把你現在的生活想一遍，最後問：「我該回去上班嗎？」想好了，按住牌。',
    lock: ['回去之後會怎樣、半年後的你', '他的答案：回去，還是再等等', '接下來三個月，該做的三件事'],
    build: buildBack,
  },
};

/* ================================================================
   連牌：同一條路上的牌一起看
   參考 tarot-skill 的經典組合與因果／遞進／轉折概念：
   https://github.com/daman-ovo-0404/tarot-skill
   以下句子為山邊塔羅原創。只補充解讀，不參與原有答案計分。
   不混接「留下／離開」兩條不同的路，也不套用 78 張牌的花色比例。
   ================================================================ */
const CARD_PAIRS = [
  { ids: [13, 17],
    up: '死神帶來收尾，星星留住重新相信的力氣。這兩張一起出現，提醒你替失去的東西留一段整理時間，再慢慢接回想做的事。',
    rev: '收尾和恢復還沒有接上。可能還捨不得放手，也可能已經離開，卻還沒有力氣重新開始。先整理一件仍在消耗你的舊事。' },
  { ids: [16, 17],
    up: '高塔把撐不住的地方攤開，星星讓你看見仍然可用的東西。先分清楚哪些得重做、哪些能帶走，重建才有起點。',
    rev: '改變已經讓你不安，信心也還沒有跟上。先找一個能穩住生活的支點，像是固定收入、作息或一位能商量的人，再處理下一步。' },
  { ids: [13, 20],
    up: '死神談結束，審判問你還要不要用原來的方式過下去。把這段經驗最不想重複的事寫下來，下次選擇就有一道清楚的界線。',
    rev: '有些事想結束，卻還在等別人替你確認。先列出這段經驗帶走了什麼、留下了什麼，別讓下一個選擇只剩下逃開。' },
  { ids: [18, 19],
    up: '月亮裡的猜測遇上太陽的照明。這組牌適合把擔心拿去查證：找一個真正知道情況的人，問清楚一件你一直在猜的事。',
    rev: '你已經感覺到問題，手上的資訊卻還不完整。先把知道的事實和自己的推測分成兩欄，缺的那一塊去問，不急著替它下結論。' },
  { ids: [8, 15],
    up: '惡魔讓你看見綁住自己的東西，力量讓你有機會換一種回應。先從一個做得到的界線開始，例如替額外接下的工作訂好範圍。',
    rev: '你知道什麼在消耗自己，但一碰到它，還是容易退讓或用力過頭。先選一個最小的界線，練習守住一次，再慢慢擴大。' },
  { ids: [1, 2],
    up: '女祭司保留觀察，魔術師把手上的東西拿來試。直覺可以提出方向，下一步用一個小作品或一次實際詢問，看看它能不能落地。',
    rev: '想法和行動還沒有對上。有些資訊沒想清楚，有些能力也還沒用出來。先確認最重要的一個疑問，再做一個小規模的嘗試。' },
  { ids: [6, 9],
    up: '隱士讓你聽清自己的標準，戀人把選擇放回眼前。做決定前，寫下最不能妥協的三件事，再拿每個選項逐一對照。',
    rev: '想獨自想清楚，又怕選了讓別人失望。先把自己的需要和別人的期待分開寫，你才看得見究竟是哪一邊在拉住你。' },
  { ids: [4, 10],
    up: '皇帝靠安排穩住局面，命運之輪帶來計畫外的變動。把必須守住的底線訂好，其餘留一點調整空間，計畫才接得住變化。',
    rev: '越想把每件事控制好，變動越容易讓你累。先準備一個備案，把自己能決定的部分做好，其餘等資訊到了再調整。' },
  { ids: [10, 11],
    up: '命運之輪把機會帶到眼前，正義要你看清交換條件。遇到選項時，把責任、報酬和時間逐項確認，別只憑第一眼的感覺。',
    rev: '時機和條件之間還有落差。先確認誰負責什麼、承諾何時兌現，再決定要投入多少力氣，口頭說好的事也記下來。' },
  { ids: [13, 16],
    up: '死神和高塔一起出現，把收尾與重整放得很重。這條路先看退場成本、生活安排和交接，先讓日子接得上，再處理想重做的部分。',
    rev: '有些地方已經很難再撐，你卻還沒找到放手的方式。先盤點能保住的資源和可以求助的人，把變動拆成幾步處理。' },
  { ids: [0, 21],
    up: '愚者想跨出去，世界想把一段路走完整。開始新的事情之前，替舊的事情收個尾，帶著已經累積的本事出發。',
    rev: '一邊想重新開始，一邊還有事情懸著。先選一件能完成的舊事做完，再替新方向排一個小起點，兩邊才不會一直互相拉扯。' },
  { ids: [0, 1],
    up: '愚者帶來起心動念，魔術師提醒你手上已有工具。先做一個小版本，用現有的時間和能力試一次，讓想像有可以對照的結果。',
    rev: '開始的衝動有了，準備和執行還沒有接上。先把需要的時間、工具和第一步列出來，選一項今天能完成的事。' },
  { ids: [1, 7],
    up: '魔術師把能力集中起來，戰車把它推向一個方向。這組牌適合縮小目標，先完成一件能證明實力的事，再爭取下一步。',
    rev: '力氣分散在太多地方，做了不少，方向卻還不清楚。先停掉一件和目標無關的事，把時間留給最重要的那一項。' },
  { ids: [2, 9],
    up: '女祭司和隱士都在替你留一段安靜觀察的空間。先整理最近反覆出現的感受，再找一個信得過的人核對，讓自己想得更清楚。',
    rev: '一個人想得太久，容易只聽見自己的猜測。先把最卡住的問題說給一位信任的人聽，借另一個角度確認一下。' },
  { ids: [3, 4],
    up: '女皇照顧能長出東西的地方，皇帝替它搭好架子。你投入的事需要空間，也需要範圍，先把時間、資源和責任安排清楚。',
    rev: '照顧別人的需要和守住自己的安排，還沒找到平衡。先確認哪一份責任真的是你的，再把能投入的時間講清楚。' },
  { ids: [4, 5],
    up: '皇帝和教皇都把制度放到眼前。這條路值得先了解規則、分工與評價方式，確認它們是否容得下你想做的事。',
    rev: '制度、權威或舊習慣正在讓你卡住。先查清楚哪些規定真的不能動，哪些只是大家一直這樣做，才知道從哪裡談起。' },
  { ids: [6, 7],
    up: '戀人問你要選哪一邊，戰車問你選完要怎麼走。先訂一個判斷標準，再替選定的方向安排下一步，力氣才不會來回耗掉。',
    rev: '選擇和行動之間還有拉扯。先把兩邊各自要付出的代價寫下來，挑一個可以實際查證的差異，再往下決定。' },
  { ids: [7, 8],
    up: '戰車想往前推，力量提醒你掌握節奏。把力氣用在真正重要的事上，同時替休息留位置，這段路才走得久。',
    rev: '你可能已經用力很久，進度卻沒有跟上消耗。先減少一項負擔，再把目標拆小，讓每一步都有能完成的份量。' },
  { ids: [9, 12],
    up: '隱士想看清楚，倒吊人願意換一個角度。這組牌適合暫緩慣常的做法，找一位走過相似路的人，聽聽另一種安排。',
    rev: '等待和反覆思考已經占掉不少力氣。替這段觀察期訂一個日期，在那之前收集一項新資訊，別讓等待只是原地重想。' },
  { ids: [10, 21],
    up: '命運之輪帶動變化，世界把一段經驗收攏起來。先把做過的事整理成能帶走的成果，機會來時，你才有東西可以拿出來。',
    rev: '事情像快走到一個段落，卻總有一塊接不上。先確認欠的是資源、時間還是某個人的回覆，補上那一塊再往下走。' },
  { ids: [12, 13],
    up: '倒吊人問這份等待值不值得，死神問哪些事可以到此為止。替等待訂一個能檢查的條件，時間到了，就依實際變化決定。',
    rev: '已經付出的時間，讓你更難承認自己想換一條路。先列出繼續等的成本，再寫下停止等待後，生活需要怎麼接。' },
  { ids: [8, 14],
    up: '力量讓你穩住回應，節制幫你調整份量。把改變放進平常的生活裡，一次改一件能持續的小事，慢慢試到合適的節奏。',
    rev: '你正在勉強自己配合一個還不合身的節奏。先觀察哪一段最耗力，調低那裡的負擔，再看整體是否比較能持續。' },
  { ids: [15, 16],
    up: '惡魔指出綁住你的條件，高塔讓那些條件變得難以忽視。先盤點收入、承諾與依賴，找出一個可以減少綁定的做法。',
    rev: '你已經看見讓自己受困的地方，卻還在擔心改動後的代價。先準備一份可用的退路，把可以分開處理的事一項項拆開。' },
  { ids: [19, 21],
    up: '太陽讓成果看得見，世界讓它有完整的樣子。把已完成的事整理成作品、紀錄或具體數字，讓別人也看得懂你的累積。',
    rev: '有些成果已經做出來，你卻還覺得差一點。先訂清楚這一版完成的標準，達到了就讓它出去接受回應，再決定下一版。' },
];

function connectionArc(group) {
  const first = group[0], last = group[group.length - 1];
  const a = cardE(first.draw), b = cardE(last.draw);
  if (first.pos === '天賦') {
    return a < 0 || b < 0
      ? '天賦和熱情分開看，會以為自己少了一塊。放在一起看，先找一件做得到、也願意再做一次的小事，替它留出固定時間。'
      : '把做得來的事和願意持續做的事放在一起，方向會更具體。先找一個能同時用到兩者的小任務，留下做完後的感受。';
  }
  if (first.pos === '阻礙') {
    return b < 0
      ? '阻礙和方向連著看，這條路還需要試。先挑一項最小的嘗試，記下實際卡在哪裡，下一次就知道要補什麼。'
      : a < 0
        ? '方向有可以試的地方，阻礙也有需要先處理的部分。把第一步縮到現在做得到的範圍，先取得一次實際回應。'
        : '阻礙和方向放在一起看，可以先試一小段。找一個真實任務做做看，讓結果幫你確認下一步。';
  }
  if (first.group === '心') {
    return cardE(last.draw) < 0
      ? '想要的生活和卡住你的條件，要一起安排。先把最需要處理的代價算清楚，目標才有能走近的方法。'
      : '把想要的生活和眼前的阻力分開寫，看看哪些能先調整。這週先完成一項不必大幅改動生活的準備。';
  }
  if (first.pos === '現在的你') {
    return b < 0
      ? '現在的狀態和心裡的聲音，都值得留一點時間確認。這週替自己留兩個小時，觀察離開家務或照顧責任後，最想把時間用在哪裡。'
      : '把現在的日子和心裡想要的生活並排看。先挑一個想拿回來的時段，試著安排一件屬於自己的事，看看感受有沒有變。';
  }
  const span = `從「${first.pos}」到「${last.pos}」`;
  if (a < 0 && b > 0) return `${span}，牌面有從受阻走向開展的變化。中間的準備很重要，先把眼前最卡的一件事拆小，逐步累積能往前的條件。`;
  if (a > 0 && b < 0) return `${span}，開頭的動力和後面的負擔不太一樣。先確認這條路長期需要的時間、體力與支持，替自己留出調整空間。`;
  if (a >= 0 && b > 0) return `${span}，有可以逐步累積的空間。先留下一個可檢查的小成果，過一段時間回頭看，再決定要增加多少投入。`;
  if (a < 0 && b < 0) return `${span}，同一類阻力還在。先找出需要改變的條件，像是分工、時間或資源，觀察它有沒有被實際回應。`;
  if (b < 0) return `${span}，後段有需要預留力氣的地方。把承諾和代價先問清楚，能事先安排的部分，先替自己安排好。`;
  if (a < 0) return `${span}，阻力有鬆動的跡象，但方向仍需要確認。先試一小段，留下實際經驗，再拿來決定下一步。`;
  return `${span}，變化還需要多一點實際資訊來確認。這週選一件能查證的事去問或去試，讓下一步有具體依據。`;
}

function readConnections(cards) {
  const groups = [];
  for (const c of cards) {
    let group = groups.find(g => g[0].group === c.group);
    if (!group) groups.push(group = []);
    group.push(c);
  }
  return groups.filter(g => g.length > 1).map(group => {
    let match = null;
    // 相鄰牌優先，其次才看同一條路的首尾，最多取一組以免解讀太長。
    for (let gap = 1; gap < group.length && !match; gap++) {
      for (let i = 0; i + gap < group.length && !match; i++) {
        const pair = [group[i], group[i + gap]];
        const rule = CARD_PAIRS.find(r => r.ids.includes(pair[0].draw.card.n) && r.ids.includes(pair[1].draw.card.n));
        if (rule) match = {
          rule: rule.ids.join('-'),
          indices: pair.map(c => cards.indexOf(c)),
          label: pair.map(c => `${c.pos}・${cardName(c.draw)}`).join(' ＋ '),
          text: pair.some(c => c.draw.rev) ? rule.rev : rule.up,
        };
      }
    }
    let arc = connectionArc(group);
    if (group.length === 3 && ['留下', '離開', '月份'].includes(group[0].group)) {
      const [start, middle, end] = group.map(c => cardE(c.draw));
      if (middle < 0 && start >= 0 && end >= 0) arc += `「${group[1].pos}」的阻力落在中段，先替那裡留一點時間和備案，別把一時卡住當成整條路都走不通。`;
      else if (middle > 0 && start < 0 && end < 0) arc += `「${group[1].pos}」有短暫開展的空間，留意讓它能持續的條件，別只看那一次順利。`;
    }
    return {
      group: group[0].group,
      pair: match,
      span: group.map(c => c.pos).join(' → '),
      text: arc,
    };
  });
}

// 所有題目共用連牌處理。既有 build 的答案、牌義與步驟照原邏輯產生。
for (const t of Object.values(TOPICS)) {
  const build = t.build;
  t.build = (a, draws) => {
    const reading = build(a, draws);
    return { ...reading, connections: readConnections(reading.cards) };
  };
}
