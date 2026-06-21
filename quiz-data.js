/* ============================================================
   quiz-data.js  —  整合資料層（A1 / A2 / A3）
   ------------------------------------------------------------
   A1 標準 schema 決策：
   來源 26 個測驗頁的每題原始格式為「巢狀雙語」：
     { id, difficulty, points, answer,
       zh:{question, options[], explanation},
       en:{question, options[], explanation} }
   平台引擎吃的是「攤平」格式。為了「零重新轉錄、零索引位移」，
   我們不手動改寫 1040 題，而是保留來源檔為單一真實來源（source of
   truth），由 loader.js 於載入時把巢狀格式正規化成下列攤平 wire 格式：
     { q, qz, o[], oz[], a, exp, expz, pd, pts }
       q/qz   = en/zh question
       o/oz   = en/zh options
       a      = answer（索引，直接沿用，不重算）
       exp/expz = en/zh explanation（C1 解析顯示用）
       pd     = 每題難度  pts = 每題配分
   ============================================================ */

/* ---------- A2：新分類法（依實際科目重建） ---------- */
const CATS = [
  { id:'prog', icon:'💻', c:'#a855f7', bg:'rgba(168,85,247,0.12)', en:'Programming',      zh:'程式語言',   d:'medium' },
  { id:'ee',   icon:'⚡', c:'#f59e0b', bg:'rgba(245,158,11,0.12)', en:'Electrical & Electronics', zh:'電機電子', d:'hard' },
  { id:'math', icon:'🧮', c:'#6366f1', bg:'rgba(99,102,241,0.12)', en:'Mathematics',      zh:'數學',       d:'medium' },
  { id:'sys',  icon:'🖥️', c:'#14b8a6', bg:'rgba(20,184,166,0.12)', en:'Computer Systems', zh:'計算機系統', d:'medium' },
  { id:'sci',  icon:'🔬', c:'#ec4899', bg:'rgba(236,72,153,0.12)', en:'Physics & Others', zh:'物理與其他', d:'hard' },
];

/* ---------- A3：測驗註冊表（每卷 metadata，題目延後載入） ----------
   src     = 來源 HTML（與本檔同目錄，部署於伺服器時 loader 以 fetch 取得）
   varName = 來源檔中題目陣列的變數名（loader 用來定位陣列）
   n       = 題數（皆 40）   d = 整卷難度   tm = 建議作答分鐘
   cmp/rat = 顯示用人數/評分（佔位預設值，之後可接後端） */
const QUIZZES = [
  // — 程式語言 —
  { id:'python', cat:'prog', src:'quizzes/python.html',                 varName:'questions',    en:'Python Programming',        zh:'Python 程式語言',     de:'Syntax, data types, OOP and the GIL.',         dz:'語法、資料型別、物件導向與 GIL。',       n:40, d:'medium', tm:18, rat:4.8, cmp:9200 },
  { id:'java',   cat:'prog', src:'quizzes/java.html',                   varName:'questions',    en:'Java Programming',          zh:'Java 程式語言',       de:'JVM, collections, generics and concurrency.',  dz:'JVM、集合、泛型與並行處理。',           n:40, d:'medium', tm:18, rat:4.7, cmp:7600 },
  { id:'c',      cat:'prog', src:'quizzes/c.html',                      varName:'questions',    en:'C Programming',             zh:'C 程式語言',          de:'Pointers, memory and undefined behavior.',     dz:'指標、記憶體與未定義行為。',             n:40, d:'hard',   tm:20, rat:4.6, cmp:6800 },
  { id:'sql',    cat:'prog', src:'quizzes/sql.html',                    varName:'questions',    en:'SQL',                       zh:'SQL',                 de:'Queries, joins, indexes and transactions.',    dz:'查詢、JOIN、索引與交易。',               n:40, d:'medium', tm:16, rat:4.7, cmp:8100 },
  { id:'js',     cat:'prog', src:'quizzes/js.html',             varName:'questions',    en:'JavaScript',                zh:'JavaScript',          de:'Scope, async, prototypes and the event loop.', dz:'作用域、非同步、原型與事件迴圈。',       n:40, d:'medium', tm:18, rat:4.8, cmp:8900 },
  { id:'dsa',    cat:'prog', src:'quizzes/dsa.html',                    varName:'questions',    en:'Data Structures & Algorithms', zh:'資料結構與演算法', de:'Complexity, trees, graphs and sorting.',     dz:'複雜度、樹、圖與排序。',                 n:40, d:'hard',   tm:22, rat:4.9, cmp:10400 },

  // — 電機電子 —
  { id:'elec',   cat:'ee',   src:'quizzes/elec.html',                   varName:'questions',    en:'Electronics',               zh:'電子學',              de:'Diodes, BJT/MOSFET and amplifiers.',           dz:'二極體、BJT/MOSFET 與放大器。',         n:40, d:'hard',   tm:20, rat:4.6, cmp:5200 },
  { id:'emag',   cat:'ee',   src:'quizzes/emag.html',                   varName:'questions',    en:'Electromagnetics',          zh:'電磁學',              de:"Fields, Maxwell's equations and waves.",       dz:'場、馬克士威方程式與電磁波。',           n:40, d:'hard',   tm:22, rat:4.5, cmp:4300 },
  { id:'circuit',cat:'ee',   src:'quizzes/circuit.html',                   varName:'questions',    en:'Circuit Analysis',          zh:'電路學',              de:'KVL/KCL, transients and AC analysis.',         dz:'KVL/KCL、暫態與交流分析。',             n:40, d:'medium', tm:20, rat:4.7, cmp:6100 },
  { id:'digital',cat:'ee',   src:'quizzes/digital.html',          varName:'questions',    en:'Digital Logic Design',      zh:'數位邏輯設計',        de:'Boolean algebra, FSM and combinational logic.',dz:'布林代數、狀態機與組合邏輯。',           n:40, d:'medium', tm:18, rat:4.7, cmp:6900 },
  { id:'signals',cat:'ee',   src:'quizzes/signals.html',        varName:'questions',    en:'Signals & Systems',         zh:'訊號與系統',          de:'LTI systems, Fourier and Laplace.',            dz:'LTI 系統、傅立葉與拉普拉斯。',          n:40, d:'hard',   tm:22, rat:4.6, cmp:4800 },
  { id:'control',cat:'ee',   src:'quizzes/control.html',                 varName:'questions',    en:'Control Systems',           zh:'控制系統',            de:'Stability, root locus and feedback.',          dz:'穩定度、根軌跡與回授。',                 n:40, d:'hard',   tm:22, rat:4.6, cmp:4500 },
  { id:'comm',   cat:'ee',   src:'quizzes/comm.html',            varName:'Q',            en:'Communication Systems',     zh:'通訊系統',            de:'Modulation, Shannon limit and noise.',         dz:'調變、夏農極限與雜訊。',                 n:40, d:'hard',   tm:22, rat:4.5, cmp:3900 },

  // — 數學 —
  { id:'calc',   cat:'math', src:'quizzes/calc.html',               varName:'questions',    en:'Calculus',                  zh:'微積分',              de:'Limits, derivatives, integrals and series.',   dz:'極限、微分、積分與級數。',               n:40, d:'medium', tm:20, rat:4.8, cmp:11200 },
  { id:'linalg', cat:'math', src:'quizzes/linalg.html',         varName:'questions',    en:'Linear Algebra',            zh:'線性代數',            de:'Matrices, eigenvalues and vector spaces.',     dz:'矩陣、特徵值與向量空間。',               n:40, d:'medium', tm:20, rat:4.8, cmp:9700 },
  { id:'discrete',cat:'math',src:'quizzes/discrete.html',            varName:'questions',    en:'Discrete Mathematics',      zh:'離散數學',            de:'Logic, sets, graphs and combinatorics.',       dz:'邏輯、集合、圖論與組合。',               n:40, d:'medium', tm:20, rat:4.7, cmp:7300 },
  { id:'ode',    cat:'math', src:'quizzes/ode.html',                 varName:'questions',    en:'Differential Equations',    zh:'微分方程',            de:'ODEs, linear systems and transforms.',         dz:'常微分方程、線性系統與轉換。',           n:40, d:'hard',   tm:22, rat:4.6, cmp:5600 },
  { id:'prob',   cat:'math', src:'quizzes/prob.html',                   varName:'questions',    en:'Probability',               zh:'機率學',              de:'Distributions, Bayes and expectation.',        dz:'分布、貝氏與期望值。',                   n:40, d:'medium', tm:20, rat:4.7, cmp:8400 },
  { id:'engmath',cat:'math', src:'quizzes/engmath.html',       varName:'questions',    en:'Engineering Mathematics',   zh:'工程數學',            de:'Complex analysis, PDEs and linear algebra.',   dz:'複變、偏微分方程與線代綜合。',           n:40, d:'hard',   tm:24, rat:4.6, cmp:6200 },

  // — 計算機系統 —
  { id:'os',     cat:'sys',  src:'quizzes/os.html',                 varName:'questions',    en:'Operating Systems',         zh:'作業系統',            de:'Processes, scheduling, memory and deadlock.',  dz:'行程、排程、記憶體與死結。',             n:40, d:'medium', tm:20, rat:4.8, cmp:9100 },
  { id:'corg',   cat:'sys',  src:'quizzes/corg.html',  varName:'questions',    en:'Computer Organization',     zh:'計算機組織與架構',    de:'Pipeline, cache, ISA and memory hierarchy.',   dz:'管線、快取、指令集與記憶體階層。',       n:40, d:'hard',   tm:22, rat:4.7, cmp:6700 },
  { id:'network',cat:'sys',  src:'quizzes/network.html',       varName:'questions',    en:'Computer Networks',         zh:'計算機網路',          de:'OSI/TCP-IP, routing and protocols.',           dz:'OSI/TCP-IP、路由與通訊協定。',          n:40, d:'medium', tm:20, rat:4.8, cmp:8800 },

  // — 物理與其他 —
  { id:'physics',cat:'sci',  src:'quizzes/physics.html',                 varName:'questions',    en:'General Physics',           zh:'普通物理',            de:'Mechanics, electromagnetism and waves.',       dz:'力學、電磁與波動。',                     n:40, d:'medium', tm:20, rat:4.7, cmp:7900 },
  { id:'thermo', cat:'sci',  src:'quizzes/thermo.html',         varName:'questionsRaw', en:'Thermodynamics',            zh:'熱力學',              de:'Laws, entropy, cycles and heat transfer.',     dz:'定律、熵、循環與熱傳。',                 n:40, d:'hard',   tm:22, rat:4.6, cmp:5100 },
  { id:'infosec',cat:'sci',  src:'quizzes/infosec.html',                 varName:'questions',    en:'Information Security',      zh:'資訊安全',            de:'CIA triad, crypto, attacks and defense.',      dz:'CIA、密碼學、攻擊與防禦。',             n:40, d:'medium', tm:18, rat:4.8, cmp:8600 },
  { id:'ml',     cat:'sci',  src:'quizzes/ml.html',                  varName:'questions',    en:'Machine Learning / AI',     zh:'機器學習 / AI',       de:'Models, training, metrics and overfitting.',   dz:'模型、訓練、評估與過擬合。',             n:40, d:'hard',   tm:22, rat:4.9, cmp:12800 },
];

/* ---------- J2：每次開啟的分層抽題配額（可調整，數字＝各難度抽幾題） ----------
   每卷原始分布為 easy10 / medium15 / hard10 / trap5；下列合計 30 題（加重 hard 與 trap）。
   抽樣與洗牌在 loader.js 的 sampleQuestions() 進行，每次開啟/重試都重抽。 */
const SAMPLE = { easy:7, medium:8, hard:10, trap:5 };

if (typeof window !== 'undefined') { window.CATS = CATS; window.QUIZZES = QUIZZES; window.SAMPLE = SAMPLE; }
