'use strict';
// ============================================================
//  ストーリー（会話・エンディング）
//  [話者, 表情, 台詞]  表情: normal / happy / angry / surprised / sad / smug
//  { narration: '文' } はト書き（話者なし）。{ title: 'ID' } でボスの名前、{ bgm: '曲ID' } で曲が変わる
//  { event: '名前' } は背景の演出（3面の 'mansion'：隠れていた屋敷が姿を現す）
//  台詞はユーザーが書いたもの（1〜5面は 2.0.0、6面は 2.1.0）。あらすじとエンディングは Claude が書いた仮のもの
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
        ['reimu', 'smug', 'そのかんじあんた最近生まれた付喪神でしょ'],
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
        ['nokiba', 'smug', 'え～わっかんないの～？（煽）'],
        ['marisa', 'normal', '................'],
        ['marisa', 'smug', 'わかったぜ'],
        ['nokiba', 'smug', 'ほんとにぃ？'],
        { bgm: 'boss1' },
        ['marisa', 'smug', 'お前生まれたばっかりだろ'],
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
        ['hamishiro', 'happy', 'あっそれ私のーかえしてー'],
        { title: 'hamishiro' },
        ['reimu', 'angry', 'いらない！返すわよ！'],
        ['hamishiro', 'normal', 'なんでそんなに嫌なのよ'],
        ['reimu', 'angry', '嫌よ！人里の家がこんなに虫だらけじゃ済めたもんじゃないわ'],
        ['hamishiro', 'happy', 'えー虫がいれば私がいる。私がいれば家は守られる。いいことずくめよ'],
        { bgm: 'boss2' },
        ['reimu', 'normal', '家守がいても住む人がいなきゃ意味ないでしょ'],
        ['hamishiro', 'surprised', '住む人......考えたことなかった。'],
      ],
      after: [
        ['hamishiro', 'sad', '住む人がいないと家守もいらなくなっちゃうのかな'],
        ['reimu', 'normal', 'さぁねでもこの状況は何とかしなきゃね'],
        ['hamishiro', 'surprised', 'え？（ていうことはこの虫も！？）'],
        ['reimu', 'normal', '何か思いついたような顔しているわね。まあいいわ私には関係なさそうだし'],
        ['hamishiro', 'angry', '今のうちにお腹いっぱい食べとかないと！！！！'],
      ],
    },
    marisa: {
      before: [
        ['marisa', 'surprised', '虫の量が魔法の森並みだな、人里がこうなるとは'],
        ['hamishiro', 'happy', 'いいでしょ～あなたも少し分けてあげるわよ～'],
        { title: 'hamishiro' },
        ['marisa', 'surprised', 'わけるってまさか虫をか？'],
        ['hamishiro', 'normal', 'そうだけど？私なにか変なことでも言った？'],
        ['marisa', 'normal', '.............'],
        ['hamishiro', 'smug', '虫が嫌いな家守の方が聞いたことないわよ'],
        { bgm: 'boss2' },
        ['marisa', 'normal', '私は家守じゃないから嫌いだな'],
        ['hamishiro', 'angry', '分けてあげない！'],
      ],
      after: [
        ['marisa', 'smug', 'お前食ってるだけで空き家守ってどうすんだよ'],
        ['hamishiro', 'angry', 'いいもん全部食べちゃうもんね'],
      ],
    },
  },
  // 3面の道中（中ボス）：？？？
  stage3mid: {
    reimu: {
      before: [
        ['midboss3', 'normal', 'おや？お客さんかい。うちになにか用かい？'],
        ['reimu', 'normal', 'うちって、ここ八百屋のおじさんの家でしょ'],
        ['midboss3', 'normal', '.............'],
        ['reimu', 'normal', '.............'],
      ],
      after: [
        ['midboss3', 'surprised', 'お邪魔しましたー！'],
        ['reimu', 'surprised', 'あっ逃げた'],
      ],
    },
    marisa: {
      before: [
        ['midboss3', 'normal', 'うん？うちになんか用かね？'],
        ['marisa', 'normal', 'よう、ここの家の人か？'],
        ['midboss3', 'smug', 'いかにも'],
        ['marisa', 'smug', 'じゃあこの家の米びつがどこにあるか言ってみろよ'],
        ['midboss3', 'normal', '............'],
        ['marisa', 'smug', '図星だな'],
      ],
      after: [
        ['midboss3', 'surprised', 'お邪魔しましたー！'],
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
        { narration: '（滑沢が手をかけた戸口から、隠れていた屋敷がゆっくりと姿を現す）' },
        ['reimu', 'surprised', '立派な屋敷ね。この屋敷について全部吐きなさい'],
        ['namesawa', 'sad', 'すまんが何わしゃも知らんぞ'],
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
        { narration: '（滑沢が手をかけた戸口から、隠れていた屋敷がゆっくりと姿を現す）' },
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
        ['zashiki', 'angry', '勝手になんて言わないで！ やっといいお家が見つかって、家鳴も栂尾も喜んでたのに！ 邪魔するなんてひどい！'],
        ['reimu', 'normal', 'あんなたいそうな屋敷をたてて、そこらじゅうの家を古びさせたことにはかわりないでしょ'],
        ['zashiki', 'surprised', '古びさせたってなに？もう何言ってるのかわかんない！'],
        { bgm: 'boss6' },
        ['reimu', 'smug', '今ら逃げようとしても無駄よ'],
        ['zashiki', 'angry', '千客万来、家運隆盛……百の部屋に積もった福の重み、受け止めてみなさい！'],
      ],
      after: [
        ['reimu', 'normal', 'あんたの周りにいると、皆あんたのために何かしたくなるのね'],
        ['zashiki', 'surprised', 'そうなの？ わたし、何もお願いしてないよ'],
        ['reimu', 'normal', 'お願いしなくても、皆が勝手に動く。それがあんたの力なんでしょ'],
        ['zashiki', 'sad', '……知らなかった'],
      ],
    },
    marisa: {
      before: [
        ['marisa', 'normal', 'ようやく見つけたぜ、屋敷さまとやら'],
        ['zashiki', 'surprised', 'あ……その帽子。霧雨のお店にいた子だ'],
        { title: 'zashiki' },
        ['marisa', 'surprised', '……覚えてるのかよ'],
        ['zashiki', 'angry', 'ねえ、家鳴に何したの？ ボロボロになってるよ'],
        ['zashiki', 'sad', 'せっかく見つけたお家も崩壊しちゃうし'],
        ['marisa', 'normal', '違うぜ、その家は人里の皆の家なんだ'],
        ['zashiki', 'angry', 'そんなのしらないもん'],
        { bgm: 'boss6' },
        ['zashiki', 'angry', 'わたしが去れば家は傾き、留まれば家は栄える……あなたの家運、ここで尽きぬよう祈りなさい！'],
      ],
      after: [
        ['zashiki', 'sad', '……全部、借り物のお家だったんだ'],
        ['marisa', 'normal', '借りたもんは、返さなきゃな。……私が言うのもなんだが'],
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
