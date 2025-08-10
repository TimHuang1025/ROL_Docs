---
id: card-skill-system
title: 技能系统
sidebar_label: 技能系统
sidebar_position: 7
---

# 技能系统

## 系统概述

技能系统为每张卡牌配置1个主动技能和2个被动技能。技能等级与卡牌星级直接关联，通过升星自动提升技能等级。系统使用倍率机制计算最终技能效果，支持动态描述文本替换。

## 技能配置

### 卡牌技能定义

```csharp
// CardInfoStatic.cs
[Serializable]
public class CardInfoStatic
{
    public string activeSkillId;    // 主动技能ID（如"A1"）
    public string passiveOneId;     // 被动技能1 ID（如"P1"）
    public string passiveTwoId;     // 被动技能2 ID（如"P2"）
}
```

### 技能等级与星级关联

```csharp
// StarUpgradeRule.cs
[Serializable]
public class StarUpgradeRule
{
    public int starLevel;           // 目标星级 (1-15)
    public int[] skillLvGain;       // 技能等级 [主动, 被动1, 被动2]
}
```

#### 技能等级表

| 星级 | 主动技能 | 被动技能1 | 被动技能2 |
|------|---------|-----------|-----------|
| 0 | 0 | 0 | 0 |
| 1 | 1 | 0 | 0 |
| 2 | 1 | 1 | 0 |
| 3 | 1 | 1 | 1 |
| 4 | 1 | 1 | 1 |
| 5 | 2 | 1 | 1 |
| 6 | 2 | 2 | 1 |
| 7 | 2 | 2 | 2 |
| 8 | 3 | 2 | 2 |
| 9 | 3 | 3 | 2 |
| 10 | 3 | 3 | 3 |
| 11 | 4 | 3 | 3 |
| 12 | 4 | 4 | 3 |
| 13 | 4 | 4 | 4 |
| 14 | 4 | 4 | 4 |
| 15 | 4 | 4 | 4 |

## 技能数据模型

### 主动技能 - ActiveSkillInfo

```csharp
[Serializable]
public class ActiveSkillInfo
{
    public string id;               // 技能ID "A1"
    public string name;             // 英文名
    public string cnName;           // 中文名
    [TextArea] 
    public string description;      // 描述（包含{X}占位符）
    public float coefficient;       // 基础系数
    public Sprite iconSprite;       // 技能图标
}
```

### 被动技能 - PassiveSkillInfo

```csharp
[Serializable]
public class PassiveSkillInfo
{
    public string id;               // 技能ID "P1"
    public string name;             // 英文名
    public string cnName;           // 中文名
    public SkillTiming timing;      // 触发时机
    [TextArea] 
    public string description;      // 描述（包含{X}占位符）
    public float baseValue;        // 基础数值
    public Sprite iconSprite;       // 技能图标
}

public enum SkillTiming 
{ 
    Create = 0,         // 创建时
    BattleStart = 1,    // 战斗开始
    TurnStart = 2       // 回合开始
}
```

## 技能数据库

### ActiveSkillDatabase - 主动技能数据库

```csharp
[CreateAssetMenu(fileName = "ActiveSkillDatabase", menuName = "SkillDB/Active Database")]
public class ActiveSkillDatabase : ScriptableObject, ISkillMultiplierSource
{
    // 技能列表
    [SerializeField] private List<ActiveSkillInfo> skills = new();
    
    // 倍率表
    [SerializeField] public List<TierEntry> tierTable = new();    // 品阶倍率
    [SerializeField] public List<LevelEntry> levelTable = new();  // 等级倍率
    
    // 运行时缓存
    Dictionary<string, ActiveSkillInfo> lookup;
    Dictionary<Tier, float> tierDict;
    Dictionary<int, float> levelDict;
    
    // 接口实现
    public IReadOnlyDictionary<Tier, float> TierMultiplier => tierDict;
    public IReadOnlyDictionary<int, float> LevelMultiplier => levelDict;
    
    // 查询方法
    public ActiveSkillInfo Get(string id);
    public IReadOnlyList<ActiveSkillInfo> All => skills;
}
```

### PassiveSkillDatabase - 被动技能数据库

```csharp
[CreateAssetMenu(fileName = "PassiveSkillDatabase", menuName = "SkillDB/Passive Database")]
public class PassiveSkillDatabase : ScriptableObject, ISkillMultiplierSource
{
    // 类似ActiveSkillDatabase的结构
    [SerializeField] private List<PassiveSkillInfo> skills = new();
    [SerializeField] private List<TierEntry> tierTable = new();
    [SerializeField] private List<LevelEntry> levelTable = new();
    
    // 运行时缓存和接口实现...
}
```

### 倍率接口

```csharp
namespace Game.Core
{
    public interface ISkillMultiplierSource
    {
        /// <summary>品阶倍率表 (S/A/B → 倍率)</summary>
        IReadOnlyDictionary<Tier, float> TierMultiplier { get; }
        
        /// <summary>等级倍率表 (Lv1-5 → 倍率)</summary>
        IReadOnlyDictionary<int, float> LevelMultiplier { get; }
    }
}
```

## 技能数值计算

### SkillValueCalculator - 技能数值计算器

```csharp
public static class SkillValueCalculator
{
    /// <summary>
    /// 计算技能百分比值
    /// base × 等级倍率 × 品阶倍率 × 100
    /// </summary>
    public static float CalcPercent(float baseVal, CardInfoStatic info, float lvMul)
    {
        if (info == null) 
        {
            Debug.LogWarning("[SkillValueCalculator] CardInfoStatic is null!");
            return baseVal * lvMul * 100f;
        }
        
        // 获取品阶倍率
        float tierMul = DB.GetTierMultiplier(info.tier);
        
        // 计算最终百分比
        return baseVal * lvMul * tierMul * 100f;
    }
    
    /// <summary>
    /// 完整版本：包含所有倍率
    /// </summary>
    public static float CalcPercent(
        float baseValue,
        CardInfoStatic info,
        PlayerCard dyn,
        ISkillMultiplierProvider provider,
        int skillLv)  // 1-5
    {
        if (info == null || provider == null) return 0f;
        
        // 获取各种倍率
        float lvMul = provider.LevelMultiplier.TryGetValue(skillLv, out var lm) ? lm : 1f;
        float tierMul = DB.GetTierMultiplier(info.tier);
        float starMul = GetStarMul(dyn?.star ?? 0);  // 星级倍率（预留）
        
        return baseValue * lvMul * tierMul * starMul * 100f;
    }
}
```

### 倍率配置示例

```csharp
// 等级倍率表（示例）
Dictionary<int, float> LevelMultiplier = new()
{
    { 0, 0.0f },   // 0级：无效果
    { 1, 1.0f },   // 1级：100%
    { 2, 1.2f },   // 2级：120%
    { 3, 1.5f },   // 3级：150%
    { 4, 2.0f },   // 4级：200%
    { 5, 2.5f }    // 5级：250%（如果有）
};

// 品阶倍率表（示例）
Dictionary<Tier, float> TierMultiplier = new()
{
    { Tier.S, 1.5f },   // S级：150%
    { Tier.A, 1.2f },   // A级：120%
    { Tier.B, 1.0f }    // B级：100%
};
```

## UI实现

### 技能显示 - CardDetailsController

```csharp
public class CardDetailsController : MonoBehaviour
{
    // 主动技能UI
    private void RefreshActiveSkillUI(CardInfoStatic info, PlayerCard dyn)
    {
        if (config.activeSkillDatabase == null || info == null) return;
        
        // 获取实际显示的卡片数据（处理幻影卡）
        var (displayStatic, displayDynamic) = GetDisplayCardData(info, dyn);
        
        // 获取主动技能
        var skill = config.activeSkillDatabase.Get(displayStatic.activeSkillId);
        if (skill == null) return;
        
        // 更新图标和名称
        if (mainSkillImg != null)
            mainSkillImg.style.backgroundImage = new StyleBackground(skill.iconSprite);
        if (mainSkillNameLbl != null)
            mainSkillNameLbl.text = skill.cnName;
        
        // 获取技能等级（从星级规则表）
        int skillLv = GetSkillLevelFromStar(displayDynamic?.star ?? 0, 0);
        SetRing(mainSkillRing, mainSkillImg, skillLv);
        
        // 获取等级倍率
        var lvDict = config.activeSkillDatabase.LevelMultiplier;
        float lvMul = lvDict != null && lvDict.TryGetValue(skillLv, out var m) ? m : 1f;
        
        // 计算百分比
        float pct = SkillValueCalculator.CalcPercent(skill.coefficient, displayStatic, lvMul);
        
        // 更新描述（替换{X}）
        if (mainSkillDescLbl != null)
            mainSkillDescLbl.text = skill.description.Replace("{X}", pct.ToString("0.#"));
    }
    
    // 被动技能UI
    private void ApplyPassive(
        string id,
        VisualElement img,
        Label nameLbl,
        Label descLbl,
        VisualElement ring,
        CardInfoStatic info,
        PlayerCard dyn,
        int skillIdx)  // 1=被动1, 2=被动2
    {
        var ps = config.passiveSkillDatabase?.Get(id);
        if (ps == null) return;
        
        // 更新基础UI
        if (img != null)
            img.style.backgroundImage = new StyleBackground(ps.iconSprite);
        if (nameLbl != null)
            nameLbl.text = ps.cnName;
        
        // 获取技能等级
        int skillLv = GetSkillLevelFromStar(dyn?.star ?? 0, skillIdx);
        SetRing(ring, img, skillLv);
        
        // 获取等级倍率
        float lvMul = 1f;
        if (config.passiveSkillDatabase != null)
        {
            var levelDict = config.passiveSkillDatabase.LevelMultiplier;
            if (levelDict != null && levelDict.TryGetValue(skillLv, out var mul))
            {
                lvMul = mul;
            }
        }
        
        // 计算百分比值
        float pct = SkillValueCalculator.CalcPercent(ps.baseValue, info, lvMul);
        
        // 更新描述文本
        if (descLbl != null && !string.IsNullOrEmpty(ps.description))
        {
            string formattedDesc = ps.description.Replace("{X}", pct.ToString("0.#"));
            descLbl.text = formattedDesc;
        }
    }
}
```

### 获取技能等级

```csharp
/// <summary>
/// 从星级获取技能等级
/// </summary>
/// <param name="star">星级 (0-15)</param>
/// <param name="skillIndex">技能索引 (0=主动, 1=被动1, 2=被动2)</param>
/// <returns>技能等级 (0-4)</returns>
private int GetSkillLevelFromStar(int star, int skillIndex)
{
    // 0星时所有技能等级为0
    if (star <= 0) return 0;
    
    // 获取星级规则
    var starRule = config.cardDatabase.GetStar(star);
    if (starRule == null || starRule.skillLvGain == null) 
    {
        Debug.LogWarning($"[CardDetails] No star rule found for star {star}");
        return 0;
    }
    
    // 检查索引范围
    if (skillIndex < 0 || skillIndex >= starRule.skillLvGain.Length)
    {
        Debug.LogWarning($"[CardDetails] Invalid skill index {skillIndex}");
        return 0;
    }
    
    return starRule.skillLvGain[skillIndex];
}
```

### 技能环形边框

```csharp
private void SetRing(VisualElement ring, VisualElement icon, int level)
{
    if (ring == null || icon == null) return;
    
    // 根据等级设置颜色
    Color ringColor = level switch
    {
        0 => new Color(0.5f, 0.5f, 0.5f, 0.3f),  // 灰色（未解锁）
        1 => new Color(0.4f, 0.7f, 1f, 0.8f),    // 蓝色
        2 => new Color(0.6f, 0.4f, 0.9f, 0.8f),  // 紫色
        3 => new Color(1f, 0.8f, 0.2f, 0.8f),    // 金色
        4 => new Color(1f, 0.4f, 0.2f, 0.8f),    // 橙色
        _ => Color.white
    };
    
    ring.style.borderTopColor = ringColor;
    ring.style.borderRightColor = ringColor;
    ring.style.borderBottomColor = ringColor;
    ring.style.borderLeftColor = ringColor;
    
    // 设置边框宽度
    float borderWidth = level > 0 ? 3 : 1;
    ring.style.borderTopWidth = borderWidth;
    ring.style.borderRightWidth = borderWidth;
    ring.style.borderBottomWidth = borderWidth;
    ring.style.borderLeftWidth = borderWidth;
}
```

## 技能详情弹窗

### SkillDetailPopup - 技能详情查看

```csharp
public class SkillDetailPopup : MonoBehaviour
{
    // 格式化描述文本
    string FormatDesc(int lv)
    {
        string rawDesc = Get<string>("description") ?? "—";
        
        // 主动技能：替换 {X} 占位符
        if (curSlot == SkillSlot.Active)
        {
            float coefficient = Get<float>("coefficient");
            
            if (activeDB != null)
            {
                // 获取等级倍率
                var lvDict = activeDB.LevelMultiplier;
                float lvMul = 1f;
                if (lvDict != null && lvDict.TryGetValue(lv, out var multiplier))
                {
                    lvMul = multiplier;
                }
                
                // 计算百分比值
                float pct = coefficient * lvMul * 100f;
                
                // 替换描述中的 {X}
                return rawDesc.Replace("{X}", pct.ToString("0.#"));
            }
        }
        else // 被动技能
        {
            float baseValue = Get<float>("baseValue");
            
            if (passiveDB != null)
            {
                var lvDict = passiveDB.LevelMultiplier;
                float lvMul = 1f;
                if (lvDict != null && lvDict.TryGetValue(lv, out var multiplier))
                {
                    lvMul = multiplier;
                }
                
                float finalValue = baseValue * lvMul * 100f;
                return rawDesc.Replace("{X}", finalValue.ToString("0.#"));
            }
        }
        
        return rawDesc;
    }
}
```

## 技能示例

### 主动技能示例

```csharp
// ActiveSkillInfo 示例
{
    id = "A1",
    cnName = "横扫千军",
    description = "对所有敌人造成{X}%攻击力的伤害",
    coefficient = 0.8f,  // 基础系数80%
    iconSprite = [Sprite]
}

// 3级时计算（假设等级倍率1.5，品阶倍率1.2）
// 最终伤害 = 0.8 * 1.5 * 1.2 * 100 = 144%
// 描述显示："对所有敌人造成144%攻击力的伤害"
```

### 被动技能示例

```csharp
// PassiveSkillInfo 示例
{
    id = "P1",
    cnName = "铁骑冲锋",
    timing = SkillTiming.BattleStart,
    description = "我方骑兵造成的伤害提高{X}%",
    baseValue = 0.23f,  // 基础值23%
    iconSprite = [Sprite]
}

// 2级时计算（假设等级倍率1.2，品阶倍率1.0）
// 最终加成 = 0.23 * 1.2 * 1.0 * 100 = 27.6%
// 描述显示："我方骑兵造成的伤害提高27.6%"
```

## 特殊规则

### 1. 幻影卡技能

```csharp
// 获取实际显示的卡片数据（处理幻影卡）
private (CardInfoStatic, PlayerCard) GetDisplayCardData(CardInfoStatic info, PlayerCard dyn)
{
    // 如果是幻影卡，使用复制目标的数据
    if (dyn?.isPhantom == true && !string.IsNullOrEmpty(dyn.cloneOn))
    {
        var targetCard = PlayerCardBank.I.Get(dyn.cloneOn);
        if (targetCard != null)
        {
            var targetStatic = config.cardDatabase.GetCard(targetCard.id);
            if (targetStatic != null)
            {
                return (targetStatic, targetCard);
            }
        }
    }
    
    return (info, dyn);
}
```

### 2. 技能等级上限

- 主动技能最高4级（部分卡牌可能更高）
- 被动技能最高4级
- 0星时所有技能为0级（未激活）

### 3. 描述文本规则

- 使用 `{X}` 作为数值占位符
- 计算结果保留1位小数
- 百分比值已经乘以100

## 配置文件位置

| 配置类型 | 路径 | 说明 |
|---------|------|------|
| **主动技能数据库** | `Resources/ActiveSkillDB` | 所有主动技能配置 |
| **被动技能数据库** | `Resources/PassiveSkillDB` | 所有被动技能配置 |
| **星级规则** | `Resources/CardDatabaseStatic` | 包含skillLvGain配置 |

## 注意事项

1. **技能等级同步**
   - 技能等级与星级严格绑定
   - 升星时自动提升技能等级
   - 不支持独立升级技能

2. **倍率计算顺序**
   - 基础值 × 等级倍率 × 品阶倍率 × 100
   - 结果已经是百分比形式

3. **UI刷新**
   - 星级变化时刷新技能等级显示
   - 动态替换描述中的数值
   - 更新技能环形边框颜色

4. **数据缓存**
   - 技能数据库在OnEnable时构建缓存
   - 使用Dictionary加速查询

5. **错误处理**
   - 检查技能ID是否存在
   - 验证skillLvGain数组索引
   - 处理null引用情况

## 相关文档

- [卡牌系统概述](./card-overview.md)
- [升星系统](./card-star-system.md)
- [卡牌数据模型](./card-data-model.md)
- [UI系统](./card-ui-system.md)