window.LIMBUS = window.LIMBUS || {};
window.LIMBUS.spirits = [
  { "name": "パニック", "price": "0欠片", "morale": "なし", "panic": "行動不能。全ての耐性が脆弱になる" },
  { "name": "圧倒", "price": "0欠片", "morale": "R開始時、武装解除2を得る", "panic": "行動不能。混乱復帰時、虚弱3と脆弱5を得る" },
  { "name": "萎縮", "price": "0欠片", "morale": "R開始時、束縛3を得る", "panic": "虚弱3を得て、全ての耐性が脆弱になる" },
  { "name": "悔しさ", "price": "50欠片", "morale": "R開始時、ダメージ量増加1と脆弱2を得る", "panic": "ダメージ量増加2と脆弱5を得て全ての耐性が脆弱になる" }
];

window.LIMBUS.items = [
  { "name": "包帯", "category": "回復", "price": "15LP", "effect": "使用時2d6を振り、6以上が出ればHPを10回復する上、再使用できる。5以下が出れば消滅（戦闘中使用不可）" },
  { "name": "鎮静剤", "category": "回復", "price": "20LP", "effect": "使用時、SANを25回復（使用後消滅）（自分以外に使用不可）" },
  { "name": "HP弾", "category": "回復", "price": "20LP", "effect": "使用時、HPを20回復（使用後消滅）" },
  { "name": "自我の欠片", "category": "特殊", "price": "2LP", "effect": "購入時、自我の欠片1を得る" },
  { "name": "硝子の破片", "category": "特殊", "price": "20LP", "effect": "使用時、該当する人格のCTを1減少（使用後消滅）" }
];

window.LIMBUS.body = {
  "families": [
    { "id": "hp0", "label": "肉体強化0", "stat": "hp", "per": 2, "costs": [5, 10, 15, 20, 25], "for": ["normal", "special"] },
    { "id": "san0", "label": "精神強化0", "stat": "san", "per": 2, "costs": [5, 10, 15, 20, 25], "for": ["normal", "special"] },
    { "id": "hpA", "label": "肉体強化A", "stat": "hp", "per": 5, "costs": [30, 35, 40, 45, 50], "for": ["normal", "special"] },
    { "id": "sanA", "label": "精神強化A", "stat": "san", "per": 5, "costs": [30, 35, 40, 45, 50], "for": ["normal", "special"] },

    { "id": "lcbHpA", "label": "肉体強化LCB-A", "stat": "hp", "per": 5, "costs": [20, 30, 40], "for": ["lcb"] },
    { "id": "lcbHpB", "label": "肉体強化LCB-B", "stat": "hp", "per": 10, "costs": [50, 60, 70], "for": ["lcb"] },
    { "id": "lcbSanA", "label": "精神強化LCB-A", "stat": "san", "per": 5, "costs": [20, 30, 40], "for": ["lcb"] },
    { "id": "lcbSanB", "label": "精神強化LCB-B", "stat": "san", "per": 10, "costs": [50, 60, 70], "for": ["lcb"] },

    { "id": "s0HpA", "label": "肉体強化0-A", "stat": "hp", "per": 5, "costs": [20, 30, 40], "for": ["sync0"] },
    { "id": "s0HpB", "label": "肉体強化0-B", "stat": "hp", "per": 10, "costs": [50, 60, 70], "for": ["sync0"] },
    { "id": "s0SanA", "label": "精神強化0-A", "stat": "san", "per": 5, "costs": [20, 30, 40], "for": ["sync0"] },
    { "id": "s0SanB", "label": "精神強化0-B", "stat": "san", "per": 10, "costs": [50, 60, 70], "for": ["sync0"] },

    { "id": "s00HpA", "label": "肉体強化00-A", "stat": "hp", "per": 5, "costs": [30, 40, 50], "for": ["sync00"] },
    { "id": "s00HpB", "label": "肉体強化00-B", "stat": "hp", "per": 10, "costs": [60, 80, 100], "for": ["sync00"] },
    { "id": "s00SanA", "label": "精神強化00-A", "stat": "san", "per": 5, "costs": [30, 40, 50], "for": ["sync00"] },
    { "id": "s00SanB", "label": "精神強化00-B", "stat": "san", "per": 10, "costs": [60, 80, 100], "for": ["sync00"] },

    { "id": "s000HpA", "label": "肉体強化000-A", "stat": "hp", "per": 5, "costs": [30, 50, 70], "for": ["sync000"] },
    { "id": "s000HpB", "label": "肉体強化000-B", "stat": "hp", "per": 10, "costs": [90, 110, 130], "for": ["sync000"] },
    { "id": "s000SanA", "label": "精神強化000-A", "stat": "san", "per": 5, "costs": [30, 50, 70], "for": ["sync000"] },
    { "id": "s000SanB", "label": "精神強化000-B", "stat": "san", "per": 10, "costs": [90, 110, 130], "for": ["sync000"] }
  ],
  "specials": [
    { "id": "atk", "label": "燃え上がる闘志", "cost": 150, "effect": "人格の攻撃スキルの威力+1" },
    { "id": "def", "label": "進むべき守備", "cost": 150, "effect": "人格の守備スキルの威力+1" },
    { "id": "regen", "label": "自生する肉体", "cost": 150, "effect": "人格が戦闘開始時、HPを4回復" },
    { "id": "deadslot", "label": "死亡後パッシブ追加", "cost": 200, "effect": "死亡後パッシブ装備スロットを人格に1枠追加する" },
    { "id": "supslot", "label": "サポートスロット追加", "cost": 300, "effect": "人格のサポートパッシブ装備スロットが2枠から3枠になる" }
  ]
};
