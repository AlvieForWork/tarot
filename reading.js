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
    () => ({ work: '你還在上班，可以邊做邊試，不用先辭職。', jobless: '空檔期正好拿來小規模試做，不用急著找下一份。', student: '趁還是學生，多試幾種，不用一次選定。', freelance: '你已經在接案，可以直接把新方向放進作品裡試。' })[a.status],
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
    shuffleSay: '把心靜下來，想著「留下」和「離開」。',
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
    shuffleSay: '想著「我適合什麼」，替我洗牌。',
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
    shuffleSay: '想著「什麼時候走」，替我洗牌。',
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
    shuffleSay: '想著那個你一直想去的地方，替我洗牌。',
    lock: ['出發之後會怎樣、一年後的你', '他的答案：出發，還是再等等', '接下來三個月，該做的三件事'],
    build: buildLeap,
  },
};
