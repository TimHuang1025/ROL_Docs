---
id: card-star-system
title: 卡牌升星系统
sidebar_label: 升星系统
sidebar_position: 4
---

# 卡牌升星系统

## 系统概述

升星系统通过消耗卡牌碎片提升卡牌星级（0-15星），每次升星都会提升技能等级和战力加成。系统支持专属碎片和通用碎片两种材料。

## 升星规则

### StarUpgradeRule - 配置结构

```csharp
[Serializable]
public class StarUpgradeRule
{
    public int starLevel;          // 目标星级 (1-15)
    public int shardsRequired;     // 所需碎片数量
    public int battlePowerAdd;     // 战力加成值
    public int[] skillLvGain;      // 技能等级 [主动,被动1,被动2]
    public string frameColor;      // 边框颜色 (blue/purple/gold)
    public int starsInFrame;       // UI显示第几颗星
}
```

### 星级配置表

| 星级 | 所需碎片 | 战力加成 | 技能等级 | 边框颜色 | 边框内星数 |
|------|---------|---------|----------|----------|-----------|
| 0→1 | 100 | 0 | [1,0,0] | blue | 1 |
| 1→2 | 100 | 100 | [1,1,0] | blue | 2 |
| 2→3 | 200 | 1000 | [1,1,1] | blue | 3 |
| 3→4 | 200 | 2000 | [1,1,1] | blue | 4 |
| 4→5 | 400 | 3000 | [2,1,1] | blue | 5 |
| 5→6 | 600 | 5000 | [2,2,1] | purple | 1 |
| 6→7 | 800 | 8000 | [2,2,2] | purple | 2 |
| 7→8 | 800 | 13000 | [3,2,2] | purple | 3 |
| 8→9 | 1000 | 19000 | [3,3,2] | purple | 4 |
| 9→10 | 1000 | 20000 | [3,3,3] | purple | 5 |
| 10→11 | 1200 | 21000 | [4,3,3] | gold | 1 |
| 11→12 | 1200 | 23000 | [4,4,3] | gold | 2 |
| 12→13 | 1200 | 25000 | [4,4,4] | gold | 3 |
| 13→14 | 1200 | 35000 | [4,4,4] | gold | 4 |
| 14→15 | 0 | 45000 | [4,4,4] | gold | 5 |

## 碎片系统

### 碎片类型

```csharp
// 碎片ID格式
"HeroCrest_S1"        // S1专属碎片
"HeroCrest_A1"        // A1专属碎片
"HeroCrest_SGeneral"  // S级通用碎片
"HeroCrest_AGeneral"  // A级通用碎片
"HeroCrest_BGeneral"  // B级通用碎片
```

### 碎片使用逻辑

```csharp
// 计算碎片使用
void CalculateShardUsage(string cardId, Tier tier, bool useGeneral)
{
    // 获取当前星级的升星规则（注意是当前星级，不是+1）
    var rule = CardDatabaseStatic.Instance.GetStar(card.star);
    if (rule == null) return;  // 已满星或无规则
    
    int needShards = rule.shardsRequired;
    
    // 获取碎片数量（从InventoryService）
    int specificShards = GetSpecificShardCount(cardId);
    int generalShards = GetGeneralShardCount(tier);
    
    // 优先使用专属碎片
    int specUse = Mathf.Min(specificShards, needShards);
    int gap = needShards - specUse;
    
    // 不足部分用通用碎片（需要勾选）
    int genUse = (useGeneral && gap > 0) ? Mathf.Min(generalShards, gap) : 0;
    
    // 检查是否足够
    bool canUpgrade = (specUse + genUse) >= needShards;
}
```

## UI实现

### UptierPanel - 升星面板

```csharp
public class UptierPanelUI : MonoBehaviour
{
    // UI元素
    Button rankUpBtn;              // 升星按钮
    Toggle useGeneralTgl;          // 使用通用碎片开关
    
    // 材料显示
    Label playerMaterial1Num;      // 专属碎片数量
    Label material1NeedLbl;        // 专属碎片需求
    Label playerMaterial2Num;      // 通用碎片数量
    Label material2NeedLbl;        // 通用碎片需求
    
    // 星级显示
    VisualElement[] curStars;      // 当前星星
    VisualElement[] nextStars;     // 升级后星星
    
    // 技能等级显示
    Label[] lblBeforeLv;           // 升级前技能等级
    Label[] lblAfterLv;            // 升级后技能等级
}
```

### 升星流程

```csharp
void OnRankUpClicked()
{
    // 1. 获取当前星级的升星规则（注意是当前星级，不是star+1）
    var rule = CardDatabaseStatic.Instance.GetStar(dyn.star);
    if (rule == null)
    {
        PopupManager.Show("无法升星");
        return;
    }
    
    // 2. 检查材料
    int need = rule.shardsRequired;
    int specOwn = GetSpecificShardCount(dyn.id);  // 从InventoryService获取
    int genOwn = GetGeneralShardCount(info.tier);  // 从InventoryService获取
    bool useGen = useGeneralTgl?.value == true;    // 检查是否勾选使用通用
    
    if (specOwn + (useGen ? genOwn : 0) < need)
    {
        PopupManager.Show("材料不足", "碎片数量不足，无法升星");
        return;
    }
    
    // 3. 发送请求
    DoUpgradeStar();
}

void DoUpgradeStar()
{
    var request = new CardUpgradeStarRequest
    {
        card_id = dyn.id,
        use_general_crest = useGeneralTgl?.value == true ? 1 : 0
    };
    
    MessageHub.I.Request("card/upgrade_star", request, OnResponse, 10f);
}
```

### 响应处理

```csharp
void OnUpgradeStarResponse(MessageHub.Response resp)
{
    if (resp.code != 0)
    {
        HandleError(resp);
        return;
    }
    
    var data = JsonConvert.DeserializeObject<CardUpgradeStarResponse>(resp.dataJson);
    
    // 更新卡片星级
    if (data.new_card_star != null)
    {
        foreach (var kvp in data.new_card_star)
        {
            var card = PlayerCardBank.I.Get(kvp.Key);
            if (card != null)
            {
                card.star = kvp.Value;
                PlayerCardBankMgr.I.BroadcastCardUpdated(kvp.Key);
            }
        }
    }
    
    // 更新碎片余额
    if (data.current_balance != null)
    {
        foreach (var kvp in data.current_balance)
        {
            InventoryService.I?.UpdateItem(kvp.Key, kvp.Value);
        }
    }
    
    RefreshUI();
}
```

## 碎片获取

### 获取专属碎片数量

```csharp
int GetSpecificShardCount(string cardId)
{
    if (string.IsNullOrEmpty(cardId)) return 0;
    
    // 专属碎片ID格式：HeroCrest_S1, HeroCrest_A1 等
    string shardId = $"HeroCrest_{cardId}";
    
    // 从InventoryService的Shards字典获取
    if (InventoryService.I?.Shards != null && 
        InventoryService.I.Shards.TryGetValue(shardId, out long count))
    {
        return (int)count;
    }
    
    return 0;
}
```

### 获取通用碎片数量

```csharp
int GetGeneralShardCount(Tier tier)
{
    if (InventoryService.I == null || !InventoryService.I.IsInited)
    {
        return 0;
    }
    
    string shardId = tier switch
    {
        Tier.S => "HeroCrest_SGeneral",
        Tier.A => "HeroCrest_AGeneral",
        Tier.B => "HeroCrest_BGeneral",
        _ => null
    };
    
    if (string.IsNullOrEmpty(shardId)) return 0;
    
    // 通用碎片可能在Bag或Shards中
    long count = 0;
    
    // 先检查Bag
    if (InventoryService.I.Bag.TryGetValue(shardId, out long bagCount))
    {
        count = bagCount;
    }
    // 再检查Shards
    else if (InventoryService.I.Shards.TryGetValue(shardId, out long shardCount))
    {
        count = shardCount;
    }
    
    return (int)count;
}
```

## 技能等级提升

### 技能等级与星级关联

```csharp
void UpdateSkillLevelDisplay(int currentStar, int nextStar)
{
    // 获取当前星级的技能等级
    var currentRule = CardDatabaseStatic.Instance.GetStar(currentStar);
    if (currentRule != null && currentRule.skillLvGain != null && currentRule.skillLvGain.Length >= 3)
    {
        lblBeforeLv[0].text = $"Lv.{currentRule.skillLvGain[0]}";  // 主动
        lblBeforeLv[1].text = $"Lv.{currentRule.skillLvGain[1]}";  // 被动1
        lblBeforeLv[2].text = $"Lv.{currentRule.skillLvGain[2]}";  // 被动2
    }
    
    // 获取升级后技能等级
    var nextRule = CardDatabaseStatic.Instance.GetStar(nextStar);
    if (nextRule != null && nextRule.skillLvGain != null && nextRule.skillLvGain.Length >= 3)
    {
        lblAfterLv[0].text = $"Lv.{nextRule.skillLvGain[0]}";
        lblAfterLv[1].text = $"Lv.{nextRule.skillLvGain[1]}";
        lblAfterLv[2].text = $"Lv.{nextRule.skillLvGain[2]}";
    }
}
```

### 从星级获取技能等级

```csharp
int GetSkillLevelFromStar(int star, int skillIndex)
{
    if (star <= 0) return 0;  // 0星默认0级
    
    var rule = CardDatabaseStatic.Instance.GetStar(star);
    if (rule?.skillLvGain != null && skillIndex < rule.skillLvGain.Length)
    {
        return rule.skillLvGain[skillIndex];
    }
    
    return 0;
}
```

### 技能等级规则说明

- skillLvGain是一个int[]数组，包含3个值：[主动技能等级, 被动1等级, 被动2等级]
- 0星时所有技能等级为0
- 随着星级提升，技能等级逐步提高
- 15星时技能达到最高等级[4,4,4]

## 星级显示

### 星星UI更新

```csharp
void UpdateStarRows(int curStar, int nextStar)
{
    // 当前星级显示
    for (int i = 0; i < 5; i++)
    {
        if (curStars[i] == null) continue;
        
        bool filled = (curStar % 5) > i || (curStar % 5 == 0 && curStar > 0);
        curStars[i].style.opacity = filled ? 1f : 0.3f;
    }
    
    // 下一星级显示
    for (int i = 0; i < 5; i++)
    {
        if (nextStars[i] == null) continue;
        
        bool filled = (nextStar % 5) > i || (nextStar % 5 == 0);
        nextStars[i].style.opacity = filled ? 1f : 0.3f;
    }
}
```

### 边框颜色变化

```csharp
void UpdateFrameColor(int star)
{
    var rule = CardDatabaseStatic.Instance.GetStar(star);
    if (rule == null) return;
    
    Color frameColor = rule.frameColor switch
    {
        "blue" => new Color(0.2f, 0.4f, 0.8f),
        "purple" => new Color(0.6f, 0.2f, 0.8f),
        "gold" => new Color(0.9f, 0.7f, 0.2f),
        _ => Color.white
    };
    
    cardFrame.style.borderTopColor = frameColor;
    cardFrame.style.borderBottomColor = frameColor;
    cardFrame.style.borderLeftColor = frameColor;
    cardFrame.style.borderRightColor = frameColor;
}
```

## 特殊规则

### 幻影卡限制

```csharp
public void AddStar(string id, int delta)
{
    var card = PlayerCardBank.I.Get(id);
    
    // 幻影卡不能升星
    if (card.isPhantom)
    {
        Debug.LogWarning($"Cannot star up phantom card {id}");
        return;
    }
    
    card.star = Mathf.Clamp(card.star + delta, 0, 15);
    SyncPhantomsForCard(id);  // 同步幻影卡
}
```

### 满星处理

```csharp
void CheckMaxStar()
{
    if (dyn.star >= 15)
    {
        rankUpBtn.SetEnabled(false);
        rankUpBtn.text = "已满星";
        
        // 隐藏材料需求显示
        costSelLbl.text = "已满级";
        playerMaterial1Num.text = "-";
        material1NeedLbl.text = "-";
        playerMaterial2Num.text = "-";
        material2NeedLbl.text = "-";
        genMatRow.style.display = DisplayStyle.None;
        plusLbl.style.display = DisplayStyle.None;
        useGeneralTgl.style.display = DisplayStyle.None;
        
        return;
    }
    
    // 检查升星规则是否存在
    var starRule = CardDatabaseStatic.Instance.GetStar(dyn.star);
    if (starRule == null || starRule.shardsRequired == 0)
    {
        // 没有规则或不需要碎片（已满星）
        rankUpBtn.SetEnabled(false);
        rankUpBtn.text = "无法升星";
    }
}
```

## 网络协议

### 升星请求

```csharp
[Serializable]
public class CardUpgradeStarRequest
{
    public string card_id;         // 卡牌ID
    public int use_general_crest;  // 0=不使用, 1=使用通用碎片
}
```

### 升星响应

```csharp
[Serializable]
public class CardUpgradeStarResponse
{
    public Dictionary<string, int> new_card_star;      // 新星级
    public Dictionary<string, long> current_balance;   // 碎片余额
}
```

### 错误响应

```csharp
[Serializable]
public class CardUpgradeStarErrorData
{
    public int required_HeroCrest;    // 需要的碎片数
    public int current_specific;      // 当前专属碎片
    public int current_general;       // 当前通用碎片
}
```

## 碎片来源

| 来源 | 获得方式 | 碎片类型 |
|------|---------|----------|
| **抽卡重复** | 抽到已有卡牌转换为碎片 | 专属碎片 |
| **测试获取** | test/GetItem接口（调试用） | 专属/通用 |
| **服务器奖励** | 服务器返回的current_balance | 专属/通用 |

### 测试获取碎片（仅开发环境）

```csharp
// GachaPanelController中的测试代码
var req = new GetItemInput
{
    all = 0,
    item_id = new List<string> { 
        // S级碎片
        "HeroCrest_SGeneral",   // S级通用碎片
        "HeroCrest_S1",         // S1专属碎片
        
        // A级碎片
        "HeroCrest_AGeneral",   // A级通用碎片
        "HeroCrest_A1",         // A1专属碎片
        
        // B级碎片
        "HeroCrest_BGeneral",   // B级通用碎片
        "HeroCrest_B1"          // B1专属碎片
    },
    amount = 10000
};
MessageHub.I.Request("test/GetItem", req, OnGetItemResp, 8f);
```

## 注意事项

1. **碎片优先级**
   - 优先消耗专属碎片
   - 通用碎片需手动开启（通过Toggle控件）
   - 不同品质碎片不可混用

2. **技能等级**
   - 与星级严格对应，存储在StarUpgradeRule的skillLvGain数组中
   - 不可独立升级
   - 15星时达到最高等级[4,4,4]

3. **UI刷新**
   - 升星成功后刷新所有相关UI
   - 同步更新幻影卡显示
   - 广播onCardUpdated事件

4. **数据同步**
   - 碎片数量存储在InventoryService的Bag或Shards字典中
   - 星级存储在PlayerCard
   - 服务器返回current_balance更新碎片余额

5. **升星规则获取**
   - 使用`GetStar(currentStar)`获取当前星级的规则，而不是`GetStar(star+1)`
   - 15星时shardsRequired为0，表示已满星