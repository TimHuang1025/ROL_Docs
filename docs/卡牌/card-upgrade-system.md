---
id: card-upgrade-system
title: 卡牌升级系统
sidebar_label: 升级系统
sidebar_position: 3
---

# 卡牌升级系统

## 系统概述

升级系统允许玩家消耗功勋（Merit）提升卡牌等级，增强四维属性。系统支持1-999级，200级后属性增长递减但仍可继续升级。

## 等级计算器

### LevelStatCalculator

核心计算类，负责所有等级相关的数值计算。

```csharp
public static class LevelStatCalculator
{
    // 软上限（设计参考值）
    public const int MaxLevel = 200;
    
    // 核心方法
    public static Stats4 CalculateStats(CardInfoStatic info, PlayerCard dyn);
    public static Stats4 CalculateDeltaNextLevel(CardInfoStatic info, PlayerCard dyn);
    public static (int exp, int extraMat) GetUpgradeCost(int lv);
    public static int CalculateCommand(CardInfoStatic info, PlayerCard dyn);
    public static int CalculateBattlePower(CardInfoStatic info, PlayerCard dyn);
}
```

## 属性成长公式

### 基础属性曲线

攻击、防御、智力使用相同的基础曲线：

```csharp
static double BaseStatCurve(int lv)
{
    if (lv <= 100)
    {
        // 1-100级：三次方曲线
        return Math.Ceiling(0.2 * Math.Pow(lv, 3));
    }
    else
    {
        // 100级后：指数衰减曲线
        return 200_000 + Math.Ceiling(
            650 * lv + 81_250 - 7_984_980 * Math.Exp(-0.04 * lv)
        );
    }
}
```

### 统御属性曲线

带兵量使用独立的成长曲线：

```csharp
static double CommandCurve(int lv)
{
    if (lv <= 100)
    {
        return Math.Ceiling(
            0.09333 * Math.Pow(lv, 3) + 
            0.14 * Math.Pow(lv, 2) + 
            0.04667 * lv
        );
    }
    else
    {
        return Math.Ceiling(
            130 * lv + 150_450 - 68_750 * Math.Exp(-0.04 * lv) + 4
        );
    }
}
```

### 最终属性计算

```csharp
static Stats4 CalcStatsCore(int lv, Tier tier, float[] mul, int star)
{
    // 基础值
    var baseVal = BaseStatCurve(lv);
    var cmdBaseVal = CommandCurve(lv);
    
    // 品质倍率
    var tierMul = GetTierMul(tier);  // S=1.0, A=0.8, B=0.5
    
    // 星级加成
    var starBonus = GetStarBonus(star);
    
    // 计算最终属性
    int atk = starBonus + (baseVal * mul[0] * tierMul);
    int def = starBonus + (baseVal * mul[1] * tierMul);
    int iq  = starBonus + (baseVal * mul[2] * tierMul);
    int cmd = cmdBaseVal * mul[3] * tierMul;  // 统御无星级加成
    
    return new Stats4(atk, def, iq, cmd);
}
```

## 升级消耗

### 功勋消耗公式

```csharp
public static (int exp, int extraMat) GetUpgradeCost(int lv)
{
    int exp;
    
    if (lv <= 99)
    {
        // 1-99级：二次方增长
        exp = Mathf.CeilToInt(0.6f * lv * lv);
    }
    else
    {
        // 100级后：阶梯式增长
        exp = 60_000 + Mathf.CeilToInt((lv - 100) / 10f) * 5_000;
    }
    
    // 每10级需要额外材料
    int extraMat = (lv % 10 == 0) ? lv * 2 : 0;
    
    return (exp, extraMat);
}
```

### 消耗表格

| 等级范围 | 功勋公式 | 示例 |
|---------|----------|------|
| 1-99 | 0.6 × lv² | Lv50: 1500功勋 |
| 100-109 | 60000 | Lv105: 60000功勋 |
| 110-119 | 65000 | Lv115: 65000功勋 |
| 120-129 | 70000 | Lv125: 70000功勋 |
| 200+ | 110000+ | Lv300: 160000功勋 |

## UI实现

### UpgradePanel组件

```csharp
public class UpgradePanelController : MonoBehaviour, IUIPanelController
{
    // UI元素
    Label curLevelLabel;      // 当前等级
    Label nextLevelLabel;     // 下一等级
    Label costLabel;          // 消耗显示
    Button upgradeBtn;        // 升级按钮
    Button upgradeMaxBtn;     // 升满按钮
    
    // 属性增长预览
    Label atkDeltaLabel;      // 攻击增长
    Label defDeltaLabel;      // 防御增长
    Label intDeltaLabel;      // 智力增长
    Label cmdDeltaLabel;      // 统御增长
}
```

### 升级流程

```csharp
void OnUpgradeClicked()
{
    // 1. 检查条件
    var (expNeed, matNeed) = LevelStatCalculator.GetUpgradeCost(card.level);
    
    bool hasExp = PlayerResourceBank.I[ResourceType.Merit] >= expNeed;
    bool hasMat = PlayerResourceBank.I[ResourceType.AdvanceScroll] >= matNeed;
    
    if (!hasExp || !hasMat)
    {
        PopupManager.Show("材料不足");
        return;
    }
    
    // 2. 发送请求
    var request = new CardUpgradeRequest 
    { 
        card_id = card.id 
    };
    
    MessageHub.I.Request("card/upgrade_level", request, OnResponse, 10f);
}

void OnUpgradeResponse(MessageHub.Response resp)
{
    if (resp.code == 0)
    {
        // 解析响应
        var data = JsonConvert.DeserializeObject<CardUpgradeResponse>(resp.dataJson);
        
        // 更新卡牌等级
        if (data.new_card_level != null)
        {
            foreach (var kvp in data.new_card_level)
            {
                var card = PlayerCardBank.I.Get(kvp.Key);
                if (card != null)
                {
                    card.level = kvp.Value;
                    PlayerCardBankMgr.I.BroadcastCardUpdated(kvp.Key);
                }
            }
        }
        
        // 刷新UI
        RefreshUI();
    }
}
```


```

## 属性预览

显示升级后的属性变化：

```csharp
void RefreshStatPreview()
{
    // 使用增量方法计算
    var delta = LevelStatCalculator.CalculateDeltaNextLevel(info, dyn);
    
    // 更新UI标签
    addAtkLbl.text = $"+{delta.Atk}";
    addDefLbl.text = $"+{delta.Def}";
    addIntLbl.text = $"+{delta.Int}";
    addCmdLbl.text = $"+{delta.Cmd}";
    
    // 颜色标记（增量大于0显示绿色）
    Color okColor = new Color(0.25882354f, 0.41176471f, 0.04313726f, 1f);
    Color grayColor = Color.gray;
    
    addAtkLbl.style.color = delta.Atk > 0 ? okColor : grayColor;
    addDefLbl.style.color = delta.Def > 0 ? okColor : grayColor;
    addIntLbl.style.color = delta.Int > 0 ? okColor : grayColor;
    addCmdLbl.style.color = delta.Cmd > 0 ? okColor : grayColor;
}
```

## 特殊规则

### 幻影卡限制

```csharp
public void AddLevel(string id, int delta)
{
    var card = PlayerCardBank.I.Get(id);
    
    // 幻影卡不能升级
    if (card.isPhantom)
    {
        Debug.LogWarning($"Cannot level up phantom card {id}");
        return;
    }
    
    // 正常升级逻辑
    card.level = Mathf.Clamp(card.level + delta, 1, 999);
}
```

### 主公卡特殊处理

主公卡（LORD）使用独立的升级系统：

```csharp
// 主公升级消耗声望而非功勋
// 通过 LordCardService 处理
void OnUpgradeLordCard()
{
    // 检查声望
    long currentFame = PlayerResourceBank.I[ResourceType.Fame];
    var lordStatic = PlayerLordBank.I?.StaticData;
    var lordData = PlayerLordBank.I?.LordData;
    
    var nextLevel = lordStatic.GetLevel(lordData.currentLevel + 1);
    if (currentFame < nextLevel.requiredFame)
    {
        PopupManager.Show("声望不足");
        return;
    }
    
    // 调用主公升级服务
    LordCardService.I.UpgradeLevel(
        onSuccess: () => {
            // 升级成功，获得技能点
            RefreshUI();
        },
        onError: (msg) => {
            PopupManager.Show("升级失败", msg);
        }
    );
}

// 主公升级请求路径："card/lordcard_upgrade_level"
// 普通卡牌升级路径："card/upgrade_level"
```

## 属性成长示例

以S级卡牌（倍率[1.3, 1.3, 0.4, 1.0]）为例：

| 等级 | 攻击力 | 防御力 | 智力 | 统御 | 总战力 |
|------|--------|--------|------|------|--------|
| 1 | 0 | 0 | 0 | 0 | 0 |
| 10 | 260 | 260 | 80 | 10 | 610 |
| 50 | 32,500 | 32,500 | 10,000 | 610 | 75,610 |
| 100 | 260,000 | 260,000 | 80,000 | 9,330 | 609,330 |
| 200 | 423,280 | 423,280 | 130,240 | 42,780 | 1,019,580 |
| 500 | 797,780 | 797,780 | 245,540 | 81,780 | 1,922,880 |
| 999 | 1,446,860 | 1,446,860 | 445,340 | 148,680 | 3,487,740 |

## 网络协议

### 升级请求

```csharp
// 普通卡牌升级
[Serializable]
public class CardUpgradeRequest
{
    public string card_id;         // 卡牌ID
}
```

### 升级响应

```csharp
[Serializable]
public class CardUpgradeResponse
{
    public Dictionary<string, int> new_card_level;    // 新等级
    public Dictionary<string, int> current_balance;   // 资源余额
}
```

### 错误响应

```csharp
[Serializable]
public class CardUpgradeErrorData
{
    public int required_merit;           // 需要的功勋
    public int current_merit;            // 当前功勋
    public int required_advance_scroll;  // 需要的进修册
    public int current_advance_scroll;   // 当前进修册
    public int current_level;            // 当前等级
}
```

## 性能优化

### 属性缓存

```csharp
private static Dictionary<string, Stats4> _statsCache = new();

public static Stats4 GetCachedStats(string cardId, int level)
{
    var key = $"{cardId}_{level}";
    
    if (!_statsCache.ContainsKey(key))
    {
        var info = CardDatabaseStatic.Instance.GetCard(cardId);
        var tempCard = new PlayerCard { id = cardId, level = level };
        _statsCache[key] = CalculateStats(info, tempCard);
    }
    
    return _statsCache[key];
}
```

### UI优化

```csharp
// 避免频繁刷新
private float _lastRefreshTime;
private const float RefreshCooldown = 0.5f;

void RefreshUI()
{
    if (Time.time - _lastRefreshTime < RefreshCooldown) return;
    _lastRefreshTime = Time.time;
    
    // 执行UI更新...
}
```

## 注意事项

1. **等级限制**
   - 代码限制：1-999级（使用`Mathf.Clamp(level, 1, 999)`）
   - 设计软上限：200级
   - 200级后收益递减但可继续升级

2. **消耗增长**
   - 100级前：二次方增长（0.6 × lv²）
   - 100级后：阶梯式跳跃（60000基础 + 每10级增加5000）
   - 每10级需要额外的进修册（数量 = 等级 × 2）

3. **幻影卡同步**
   - 原卡升级后自动同步所有幻影卡
   - 使用`SyncPhantomsForCard`方法

4. **主公卡差异**
   - 使用独立的`LordCardService`
   - 消耗声望（Fame）而非功勋（Merit）
   - 升级获得技能点
   - 请求路径：`card/lordcard_upgrade_level`

5. **UI更新**
   - 升级成功后刷新所有相关UI
   - 广播`onCardUpdated`事件
   - 资源由MessageHub自动处理