'use strict';
// ============================================================
//  ストーリー（会話・エンディング）
//  [話者, 表情, 台詞]  表情: normal / happy / angry / surprised / sad / smug
//  { narration: '文' } はト書き（話者なし）。{ title: 'ID' } でボスの名前、{ bgm: '曲ID' } で曲が変わる
//  { event: '名前' } は背景の演出（3面の 'mansion'：隠れていた屋敷が姿を現す）
//  台詞はユーザーが書いたもの（1〜5面は 2.0.0、6面は 2.1.0、2.3.0 で1面・2面・6面を書きかえ。誤字は 2.1.1 で直した）。
//  あらすじとエンディングは Claude が書いた仮のもの
// ============================================================

const INTRO_TEXT = [
  'ある朝、人里の家々が、一晩でぼろぼろに古びてしまった。',
  '屋根には穴があき、床は虫だらけ。部屋がまるごと消えてしまった家まであるという。',
  '古びた家には付喪神や家の妖怪が住みつき、勝手気ままに騒いでいる。',
  'これはきっと異変に違いない。',
  '博麗霊夢と霧雨魔理沙は、それぞれ人里へと向かった。',
];

const STORY = {
  // 1面：軒端 鬼乃
  stage1: {
    reimu: {
      before: [
        ['reimu', 'normal', 'どこの家もひどいわね....うちの神社よりもボロボロになってるじゃない'],
        ['nokiba', 'smug', 'ふっ.......人間か'],
        { title: 'nokiba' },
        ['reimu', 'normal', '屋根の上でなにかっこつけてるのよ'],
        ['nokiba', 'smug', '私はここの屋根の鬼よ'],
        ['reimu', 'normal', '付喪神のまちがいでしょ、聞いたことないわよそんなこと'],
        ['nokiba', 'surprised', 'え？ないの？'],
        ['reimu', 'smug', 'その感じ、あなた最近生まれた付喪神かなんかでしょ'],
        ['nokiba', 'angry', 'ちっ、ちがっ'],
        { bgm: 'boss1' },
        ['reimu', 'angry', '何が鬼よ、厄介なのよねこの種の付喪神は'],
      ],
      after: [
        ['reimu', 'smug', 'それみなさい、鬼ならもっと手ごたえあるわよ'],
        ['nokiba', 'sad', '私、やっぱり付喪神だったんだ'],
        ['reimu', 'normal', '自覚はあったのね'],
      ],
    },
    marisa: {
      before: [
        ['marisa', 'normal', '人里の家が一晩でボロボロになったって聞いてきたんだが...'],
        ['marisa', 'surprised', 'こりゃあひどいな'],
        ['nokiba', 'smug', 'ボロボロじゃなくて風格がでたんだよ'],
        { title: 'nokiba' },
        ['marisa', 'normal', '誰だお前、見ない顔だな'],
        ['nokiba', 'smug', '誰だと思う？'],
        { bgm: 'boss1' },
        ['marisa', 'smug', '異変で生まれたばっかのやつには興味ないな'],
        ['nokiba', 'surprised', 'なんでわかったの！？'],
      ],
      after: [
        ['marisa', 'smug', '生まれたてはすぐ調子乗るからな'],
        ['nokiba', 'angry', 'うるさい！うるさい！'],
        ['marisa', 'normal', '私はもう行くぜ'],
        ['marisa', 'normal', '（こいつの種族ってなんだ？）'],
      ],
    },
  },
  // 2面：喰代 守子
  stage2: {
    reimu: {
      before: [
        ['reimu', 'surprised', 'うわぁなによここ、天井も虫だらけじゃない'],
        ['reimu', 'surprised', 'ひっ.....今何か落ちてきた'],
        ['kuraishiro', 'happy', 'あっそれ私のーかえしてー'],
        { title: 'kuraishiro' },
        ['reimu', 'angry', 'いらない！返すわよ！'],
        ['kuraishiro', 'normal', 'なんでそんなに嫌なのよ'],
        ['reimu', 'angry', '嫌よ！人里の家がこんなに虫だらけじゃ住めたもんじゃないわ'],
        ['kuraishiro', 'happy', 'えー虫がいれば私がいる。私がいれば家は守られる。いいことずくめよ'],
        { bgm: 'boss2' },
        ['reimu', 'normal', '家守がいても住む人がいなきゃ意味ないでしょ'],
        ['kuraishiro', 'surprised', '住む人......考えたことなかった。'],
      ],
      after: [
        ['kuraishiro', 'sad', '住む人がいないと家守もいらなくなっちゃうのかな'],
        ['reimu', 'normal', 'さぁねでもこの状況は何とかしなきゃね'],
        ['kuraishiro', 'surprised', 'え？（ていうことはこの虫も！？）'],
        ['reimu', 'normal', '何か思いついたような顔しているわね。まあいいわ、私には関係なさそうだし'],
        ['kuraishiro', 'angry', '今のうちにお腹いっぱい食べとかないと！！！！'],
      ],
    },
    marisa: {
      before: [
        ['marisa', 'surprised', '虫の量が魔法の森並みだな、人里がこうなるとは'],
        ['kuraishiro', 'happy', 'いいでしょ～あなたも少し分けてあげるわよ～'],
        { title: 'kuraishiro' },
        ['marisa', 'surprised', 'わけるってまさか虫をか？'],
        ['kuraishiro', 'normal', 'そうだけど？私なにか変なことでも言った？'],
        ['marisa', 'normal', '.............'],
        ['kuraishiro', 'smug', '虫が嫌いな家守の方が聞いたことないわよ'],
        { bgm: 'boss2' },
        ['marisa', 'normal', '私は家守じゃないから嫌いだな'],
        ['kuraishiro', 'angry', '分けてあげない！'],
      ],
      after: [
        ['marisa', 'smug', 'お前食ってるだけで空き家守ってどうすんだよ'],
        ['kuraishiro', 'angry', 'いいもん全部食べちゃうもんね'],
      ],
    },
  },
  // 3面の道中（中ボス）：？？？
  stage3mid: {
    reimu: {
      before: [
        ['namesawaMask', 'normal', 'おや？お客さんかい。うちになにか用かい？'],
        ['reimu', 'normal', 'うちって、ここ八百屋のおじさんの家でしょ'],
        ['namesawaMask', 'normal', '.............'],
        ['reimu', 'normal', '.............'],
      ],
      after: [
        ['namesawaMask', 'surprised', 'お邪魔しましたー！'],
        ['reimu', 'surprised', 'あっ逃げた'],
      ],
    },
    marisa: {
      before: [
        ['namesawaMask', 'normal', 'うん？うちになんか用かね？'],
        ['marisa', 'normal', 'よう、ここの家の人か？'],
        ['namesawaMask', 'smug', 'いかにも'],
        ['marisa', 'smug', 'じゃあこの家の米びつがどこにあるか言ってみろよ'],
        ['namesawaMask', 'normal', '............'],
        ['marisa', 'smug', '図星だな'],
      ],
      after: [
        ['namesawaMask', 'surprised', 'お邪魔しましたー！'],
        ['marisa', 'normal', '追うぜ'],
      ],
    },
  },
  // 3面：滑沢 瓢（倒したあと、隠れていた屋敷が姿を現す）
  stage3: {
    reimu: {
      before: [
        ['reimu', 'angry', '待ちなさい！逃げたってことはこの異変の犯人はあんたでしょ'],
        ['namesawa', 'surprised', '違う！違う！わしはただ空き家でくつろいでいただけじゃ'],
        { title: 'namesawa' },
        ['reimu', 'smug', 'へぇーじゃあどこへ逃げようとしたのよ'],
        ['namesawa', 'normal', 'この先にえらく大きな空き家があってな、そこなら見つからんと....'],
        ['reimu', 'normal', 'そんなの見えないわ。ますます怪しいわ'],
        ['namesawa', 'surprised', '違うんじゃ！待ってくれ！'],
        { bgm: 'boss3' },
        ['reimu', 'angry', '問答無用！'],
      ],
      after: [
        ['reimu', 'normal', 'で？そのおおきな家ってのはどこよ'],
        ['namesawa', 'normal', '目の前にあるじゃろ（ガチャ）'],
        { event: 'mansion' },
        ['reimu', 'surprised', '立派な屋敷ね。この屋敷について全部吐きなさい'],
        ['namesawa', 'sad', 'すまんがわしゃ何も知らんぞ'],
        ['reimu', 'angry', 'つかえないわね'],
      ],
    },
    marisa: {
      before: [
        ['marisa', 'normal', '人里の家に勝手に上がり込んで、家を古くしているのはお前だな？'],
        ['namesawa', 'normal', '順番が逆じゃ、わしは古くなった家に上がり込んだだけじゃ'],
        { title: 'namesawa' },
        ['marisa', 'normal', 'なんで逃げたんだ？'],
        ['namesawa', 'normal', '面倒ごとは苦手なもんでね、さっさとそこの屋敷に逃げ込みたかったんじゃが...'],
        ['marisa', 'smug', '屋敷？そんなもんないぜ、そんなでたらめ通用すると思ったか？'],
        { bgm: 'boss3' },
        ['namesawa', 'angry', '本当にあるんじゃよ！見えんのか！？'],
      ],
      after: [
        ['marisa', 'normal', '屋敷はどうなったんだ？'],
        ['namesawa', 'normal', 'あるじゃろここに'],
        { event: 'mansion' },
        ['marisa', 'surprised', 'おいおいこりゃないぜ'],
        ['namesawa', 'smug', 'ほれ、言った通りじゃったろ？'],
      ],
    },
  },
  // 4面：栂尾 芯
  stage4: {
    reimu: {
      before: [
        ['reimu', 'normal', 'ちょっと広すぎない？迷子になっちゃうわ'],
        ['toganoo', 'normal', '客人かい？誰かを呼んだ覚えはないんだけど'],
        { title: 'toganoo' },
        ['reimu', 'angry', '人の部屋を引っこ抜いて何のためにこんな屋敷を建てたのよ'],
        { bgm: 'boss4' },
        ['toganoo', 'angry', 'お前に話す義理はない'],
        ['reimu', 'smug', 'じゃあ力ずくで吐かせるのみよ'],
      ],
      after: [
        ['toganoo', 'surprised', 'もう屋敷を支えきれない。崩れるぞ！'],
        ['reimu', 'normal', 'まだ見る必要がありそうね'],
        ['toganoo', 'surprised', 'あっおい！'],
      ],
    },
    marisa: {
      before: [
        ['toganoo', 'angry', '.......玄関から入れ'],
        { title: 'toganoo' },
        ['marisa', 'normal', '場所がわからなかったんだ、仕方ないだろ'],
        ['toganoo', 'angry', '何部屋ぶち抜いてきた'],
        ['marisa', 'normal', '数えていないぜ、多分１０か１１'],
        ['toganoo', 'angry', '１４だ！一部屋ごとに人里の家から借りてきた大事な部屋だぞ'],
        ['marisa', 'smug', '借りてきたなら返せよ'],
        ['toganoo', 'angry', 'どの口が言ってるんだ'],
        ['marisa', 'normal', '何に使うんだ？こんな部屋ばっかり'],
        ['toganoo', 'normal', '言えんな'],
        { bgm: 'boss4' },
        ['marisa', 'smug', '家だけにか？'],
        ['toganoo', 'angry', 'もう帰ってくれ'],
      ],
      after: [
        ['toganoo', 'surprised', 'これ以上屋敷を維持できない。屋敷ごと崩れる、逃げるんだ！'],
        ['marisa', 'smug', 'お前、誰かかくまってるだろ'],
        ['toganoo', 'surprised', 'なっ'],
        ['marisa', 'smug', 'やっぱりな'],
      ],
    },
  },
  // 5面：家鳴 鳴音
  stage5: {
    reimu: {
      before: [
        ['yanari', 'angry', '座敷様！ 早く！ ここもすぐ崩れる！'],
        { title: 'yanari' },
        ['reimu', 'normal', 'その子を連れていかれると困るのよ'],
        ['yanari', 'angry', 'なんでこんな時に！'],
        ['reimu', 'normal', 'あんたね。人里の家を古くしてたのは'],
        ['yanari', 'angry', 'くそっ、座敷様を逃がさなきゃいけないってのに……！'],
        ['reimu', 'surprised', '座敷様？ 奥に誰かいるの？'],
        { bgm: 'boss5' },
        ['yanari', 'angry', '行かせない！ 座敷様が逃げ切るまで、ここはあたしが通さない！'],
      ],
      after: [
        ['yanari', 'sad', '座敷様……申し訳ありません'],
        ['reimu', 'normal', 'その座敷とやらはどこかしらね'],
      ],
    },
    marisa: {
      before: [
        ['yanari', 'normal', 'お前、霧雨の家の子だな。天井裏から、何度も見たことがある'],
        { title: 'yanari' },
        ['marisa', 'surprised', '人んちの天井裏に住んでたのかよ'],
        ['yanari', 'normal', '座敷様と一緒にな。あの家は座敷様のおかげで栄えてたんだ'],
        ['marisa', 'surprised', '座敷様……座敷わらしか。うちにそんなのがいたなんて聞いたことないぜ'],
        ['yanari', 'angry', '人間は気付かないもんさ。……くそっ、話してる暇なんてないのに！'],
        { bgm: 'boss5' },
        ['marisa', 'smug', '悪いな、逃がすわけにはいかないんだぜ'],
      ],
      after: [
        ['yanari', 'sad', '座敷様、すみません。せっかくの家、守れませんでした'],
        ['marisa', 'sad', '……住める家がない、か'],
      ],
    },
  },
  // 6面の道中（中ボス）：家鳴 鳴音（戦ったあとの会話はない）
  stage6mid: {
    reimu: {
      before: [
        ['yanari6', 'angry', 'なんとかここで食い止めなければ'],
        ['reimu', 'normal', 'どいてくれるかしら、しつこい奴は嫌いなのよ'],
      ],
      after: [],
    },
    marisa: {
      before: [
        ['yanari6', 'angry', 'あの子には指一本触れさせない！'],
        ['marisa', 'surprised', '信じられないな、まだやるのか'],
      ],
      after: [],
    },
  },
  // 6面：座敷 宿美
  stage6: {
    reimu: {
      before: [
        ['zashiki', 'angry', '待って！ その子をいじめないで！'],
        { title: 'zashiki' },
        ['reimu', 'normal', 'あんたが座敷ね。ふうん、確かに、なんだか憎めない顔してるわ'],
        ['zashiki', 'angry', '家鳴に何したの！？ いい子で、いつもわたしの話を聞いてくれる子なのに！'],
        ['reimu', 'normal', 'あんたを守ろうとして、勝手に倒れたのよ'],
        ['zashiki', 'angry', '勝手になんて言わないで！ やっといいお家が見つかって、家鳴も栂尾も喜んでたのに、邪魔するなんてひどい！'],
        ['reimu', 'normal', 'あんなたいそうな屋敷をたてて、そこらじゅうの家を古びさせたことにはかわりないでしょ'],
        ['zashiki', 'surprised', '古びさせたってどういうこと？'],
        ['reimu', 'smug', 'いまさらしらばっくれても無駄よ'],
        ['zashiki', 'angry', '私そんなことしてない'],
        ['reimu', 'normal', '家鳴に命じたんでしょ、あんたが'],
        ['zashiki', 'angry', '私家鳴になにも命じてないよ、家鳴と栂尾でいい家があったから一緒にいただけだもん'],
        ['reimu', 'surprised', 'あなた、本当に何も知らないのね'],
        ['zashiki', 'surprised', 'え？'],
        ['reimu', 'normal', 'あの屋敷、二人が見つけたとかじゃなくて'],
        ['reimu', 'normal', '二人が作ったものなのよ'],
        ['zashiki', 'surprised', 'あの子たちが嘘をついたっていうの？'],
        ['reimu', 'normal', '信じられないでしょうけど、崩れてる屋敷が動かぬ真実よ'],
        ['reimu', 'normal', 'すべて皆があなたのために起こしたものなのよ'],
        { bgm: 'boss6' },
        ['zashiki', 'angry', 'そう....それでも私は貴女を許さない！'],
        ['zashiki', 'angry', '百の部屋に積もった福の重み、受け止めてみなさい！'],
      ],
      after: [
        ['zashiki', 'sad', 'ごめんね、いままで気づけなくて'],
        ['reimu', 'normal', '遅すぎるぐらいだけどね'],
      ],
    },
    marisa: {
      before: [
        ['marisa', 'normal', 'ようやく見つけたぜ、座敷さまとやら'],
        ['zashiki', 'surprised', 'あ……その帽子。霧雨のお店にいた子だ'],
        { title: 'zashiki' },
        ['marisa', 'surprised', '……覚えてるのかよ'],
        ['zashiki', 'happy', '懐かしいなぁこうやって貴女と話せるなんて感慨深いね'],
        ['marisa', 'smug', '不法侵入でもそういう気持ちあるんだな'],
        ['zashiki', 'angry', 'ねえ、家鳴になにかしたんでしょ？'],
        ['marisa', 'surprised', '知ってるのか'],
        ['zashiki', 'angry', 'さっき見たもん'],
        ['zashiki', 'sad', 'せっかく見つけたお家も崩壊しちゃうし'],
        ['marisa', 'normal', '違うぜ、その家は人里の皆の家なんだ'],
        ['zashiki', 'surprised', '人里の家？'],
        ['marisa', 'normal', 'あいつらがお前をかくまうために作った屋敷なんだ'],
        ['zashiki', 'sad', 'でもわたしそんなことお願いしてないよ'],
        ['marisa', 'normal', '住む家がなかったお前をほっとけなかったんだろ'],
        ['zashiki', 'sad', 'そうだったんだ'],
        ['marisa', 'normal', '飲み込めたみたいだな'],
        { bgm: 'boss6' },
        ['zashiki', 'angry', 'そうね....でもわたしの大好きな子たちをいじめた罪は重いわよ'],
        ['zashiki', 'angry', '福の神に背いた家の行く末がどうなるか、その身で思い知りなさい！'],
        ['zashiki', 'angry', '己の家運の没落を！！！'],
      ],
      after: [
        ['zashiki', 'happy', '強くなったね....霧雨の子も'],
        ['marisa', 'normal', 'すこしは落ち着いたか？'],
        ['zashiki', 'normal', 'ええ'],
      ],
    },
  },

  // エキストラ（2.8.0。Claude が書いた仮のもの。決め台詞だけは資料「化物屋敷異変 スペルカード・弾幕案」から）
  // 中ボス：崩れた屋敷の瓦礫の上で。倒すと方位盤の異界へ（背景の { event: 'compass' }）
  extraMid: {
    reimu: {
      before: [
        { narration: '崩れ落ちた屋敷の跡。積み上がった瓦礫の上に、角と翼の生えた少女が立っていた。' },
        ['reimu', 'normal', '異変は片付いたはずなんだけど……瓦礫の上に、まだ誰かいるわね'],
        ['konjinMid', 'angry', '片付いた、じゃと？　この方角に百も部屋を積み上げておいて、よくもぬけぬけと'],
        ['reimu', 'surprised', '方角？　あんた、誰よ'],
        ['konjinMid', 'angry', '方違えも知らぬ巫女に名乗る名などないわ。まずは瓦礫ごと吹き飛ばしてくれる！'],
      ],
      after: [
        ['konjinMid', 'angry', 'ええい、ここは狭すぎる。妾の庭へ来るがよい！'],
        { event: 'compass' },
        { narration: '瓦礫の向こうに、金色に光る方位盤のような輪が開いた。' },
      ],
    },
    marisa: {
      before: [
        { narration: '崩れ落ちた屋敷の跡。積み上がった瓦礫の上に、角と翼の生えた少女が立っていた。' },
        ['marisa', 'normal', '屋敷の跡で掘り出し物探し……のつもりだったんだが、先客がいたか'],
        ['konjinMid', 'angry', '掘り出し物？　ここにあるのは、妾の通り道を塞いでおった瓦礫だけじゃ'],
        ['marisa', 'surprised', '通り道？　こんな所がか？'],
        ['konjinMid', 'angry', '百部屋の瓦礫など、妾には塵も同然。お主ごと掃いてくれるわ！'],
      ],
      after: [
        ['konjinMid', 'angry', 'ええい、ここは狭すぎる。妾の庭へ来るがよい！'],
        { event: 'compass' },
        { narration: '瓦礫の向こうに、金色に光る方位盤のような輪が開いた。' },
      ],
    },
  },
  extra: {
    reimu: {
      before: [
        ['konjin', 'smug', 'よう来たな。ここは方位の果て、八方すべてが妾の眼の内じゃ'],
        { title: 'konjin' },
        ['reimu', 'normal', 'さっきから方角、方角って。結局あんたは何に怒ってるのよ'],
        ['konjin', 'angry', 'あの屋敷は艮――鬼門に向けて建て増された。しかも人間どもは方違えひとつせず、平気で妾の行く手を塞ぐ'],
        ['reimu', 'normal', '屋敷を建てたのは妖怪たちで、もう崩れたわよ'],
        ['konjin', 'angry', '建てた者も、住んだ者も、退治に来た者も同じこと。忘れられた祟りの重さ、思い出させてくれよう'],
        { bgm: 'bossEx' },
        ['konjin', 'angry', '東西南北、天地四方。この世に妾の眼の届かぬ方角はない'],
        ['reimu', 'angry', 'だったら、その眼にしっかり焼き付けておきなさい。あんたが退治される方角をね！'],
      ],
      after: [
        ['konjin', 'sad', '……むう。方角も選ばず突っ込んでくる巫女に、祟りが当たらぬとは'],
        ['reimu', 'normal', '何回かは当たったわよ。それで、少しは気が済んだ？'],
        ['konjin', 'normal', '出かける前には暦を見て、凶方を避けるがよい。さすれば、少しは見逃してやろう'],
        ['reimu', 'normal', 'はいはい。暦くらいは神社にもあるわ'],
      ],
    },
    marisa: {
      before: [
        ['konjin', 'smug', '来たか、瓦礫拾い。ここは方位の果て、妾の遊行の道じゃ'],
        { title: 'konjin' },
        ['marisa', 'normal', '金ぴかの神様が、そんなにかっかしてどうするんだ'],
        ['konjin', 'angry', '怒らずにおれるか！　鬼門に屋敷を建て増し、方違えもせず、百の部屋で妾の通り道を塞いだのじゃぞ'],
        ['marisa', 'smug', 'その屋敷なら、もう崩れたぜ。崩したのは私たちみたいなもんだけどな'],
        { bgm: 'bossEx' },
        ['konjin', 'angry', 'ならばお主も同罪よ。金神七殺の祟り、とくと味わうがよい！'],
      ],
      after: [
        ['konjin', 'sad', '……この妾が、方角も読まぬ魔法使いに後れを取るとは'],
        ['marisa', 'happy', '方角なんて、まっすぐ前だけ見てりゃ十分だぜ'],
        ['konjin', 'normal', 'その「まっすぐ」が一番危ういのじゃ。……まあよい、今日のところは凶方を外してやろう'],
      ],
    },
  },
};

// エンディング（Claude が書いた仮のもの。6面をクリアするとここに来る）
//   guest：右側に出るほかのキャラクター（from ページ目から出る）
const ENDINGS = {
  reimu: {
    title: '座敷わらしの新しい住処',
    guest: { id: 'zashiki', from: 2, happyFrom: 4 },
    pages: [
      '屋敷が崩れたあと、借りられていた部屋は、ひとつ残らず人里の家々へ戻っていった。',
      '古びた屋根や柱も、少しずつ元の姿を取り戻しているらしい。\n家鳴や栂尾たちが、夜な夜な直して回っているという噂もある。',
      '霊夢「で、あんたはこれからどこに住むつもりなの」\n座敷「……わかんない」',
      'その夜から、博麗神社の縁側には、ちりんと鈴の音がよく響くようになった。',
      '賽銭箱の中身が、なぜか少しだけ増えたらしい。\n座敷わらしのいる家は栄えるというが……にぎやかになりすぎるのも考えものである。',
    ],
  },
  marisa: {
    title: '霧雨の家の天井裏',
    guest: { id: 'zashiki', from: 1, happyFrom: 3 },
    pages: [
      '屋敷が崩れたあと、借りられていた部屋は、それぞれの家へと戻っていった。',
      '魔理沙「借りたもんは返す。……今回だけは特別だぜ」\n座敷「ほんとに、返してくれるの？」',
      'しばらくして、霧雨店の天井裏から、また小さな鈴の音が聞こえるようになったという。',
      'その日から、霧雨店の商売は、ほんの少しだけ繁盛しているらしい。',
      '魔理沙が店に顔を出したかどうかは……誰も知らない。',
    ],
  },
};
