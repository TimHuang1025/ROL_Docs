---
id: card-data-model
title: 卡牌数据模型
sidebar_label: 数据模型
sidebar_position: 2
---

# 卡牌数据模型

## 概述

卡牌数据模型定义了游戏中所有卡牌相关的数据结构，包括动态数据（PlayerCard）、静态配置（CardInfoStatic）以及数据管理（PlayerCardBank）。

## 核心数据结构

### PlayerCard - 动态数据

玩家拥有的卡牌实例数据，包含等级、星级、装备等动态信息。

```csharp
[Serializable]
public class PlayerCard
{
    // 基础信息
    public string id;           // 卡牌ID (S1, A1, LORD等)
    public int level = 1;       // 等级 (1-999，实际无硬性上限)
    public int star = 0;        // 星级 (0-15)
    public int copies = 0;      // 拥有的碎片数量
    
    // 封赏系统
    public int giftLv = 0;      // 封赏等级 (0-3)
    public int giftExp = 0;     // 封赏经验（累计值）
    
    // 幻影卡相关
    public bool isPhantom;      // 是否为幻影卡
    public string cloneOn;      // 复制的目标卡牌ID
    public string clonedBy;     // 被哪张幻影卡复制
    public long expireTime;     // 过期时间戳（毫秒）
    
    // 装备信息
    public CardEquip equip = new CardEquip();
    
    // 元数据
    public long updatedAt;      // 更新时间戳
}
```

### CardEquip - 装备数据

```csharp
[Serializable]
public class CardEquip
{
    // 装备UUID
    public string weaponUuid;      // 武器UUID
    public string armorUuid;       // 护甲UUID
    public string accessoryUuid;   // 坐骑UUID
    
    // 装备槽解锁状态
    public bool weaponUnlocked;    // 武器槽已解锁（封赏1级）
    public bool armorUnlocked;     // 护甲槽已解锁（封赏2级）
    public bool mountUnlocked;     // 坐骑槽已解锁（封赏3级）
}
```

### CardInfoStatic - 静态配置

从配置文件加载的卡牌静态数据。

```csharp
[Serializable]
public class CardInfoStatic
{
    // 基础信息
    public string id;                      // 卡牌ID
    public string displayName;             // 显示名称
    public Tier tier;                      // 品质 (S/A/B)
    public Faction faction;                // 阵营 (wei/shu/wu/qun)
    
    // 美术资源
    public Sprite iconSprite;              // 头像图标
    public Sprite fullBodySprite;          // 全身立绘
    
    // 技能配置
    public string activeSkillId;           // 主动技能ID
    public string passiveOneId;            // 被动技能1 ID
    public string passiveTwoId;            // 被动技能2 ID
    
    // 属性成长
    public float[] base_value_multiplier;  // 基础属性倍率 [攻,防,智,统]
    
    // 描述文本
    public string trait;                   // 特性名称
    [TextArea] 
    public string description;             // 卡牌描述
}
```

## 数据管理器

### PlayerCardBank - 卡牌仓库

单例模式的卡牌数据存储中心。

```csharp
public class PlayerCardBank
{
    // 单例访问
    public static PlayerCardBank I { get; private set; }
    
    // 数据存储
    public List<PlayerCard> cards = new();
    private Dictionary<string, PlayerCard> _lookup;
    
    // 核心方法
    public PlayerCard Get(string id)
    {
        if (_lookup == null) RebuildLookup();
        return _lookup.TryGetValue(id, out var card) ? card : null;
    }
    
    public void AddCard(PlayerCard card)
    {
        if (cards.Any(c => c.id == card.id)) return;
        cards.Add(card);
        _lookup?.Add(card.id, card);
    }
    
    public void RemoveCard(string cardId)
    {
        cards.RemoveAll(c => c.id == cardId);
        _lookup?.Remove(cardId);
    }
    
    public void Clear()
    {
        cards.Clear();
        _lookup?.Clear();
    }
    
    // 单例管理
    public static void ForceReset()
    {
        I = null;
        // 下次访问时会重新创建
    }
}
```

### PlayerCardBankMgr - 业务管理器

处理卡牌业务逻辑和事件通知。

```csharp
public class PlayerCardBankMgr : MonoBehaviour
{
    // 单例
    public static PlayerCardBankMgr I { get; private set; }
    
    // 事件
    public event Action<string> onCardChanged;   // 卡牌新增/删除
    public event Action<string> onCardUpdated;   // 卡牌属性更新
    
    // 等级管理
    public void AddLevel(string id, int delta)
    {
        var card = PlayerCardBank.I.Get(id);
        if (card == null || card.isPhantom) return;
        
        card.level = Mathf.Clamp(card.level + delta, 1, 999);
        NotifyUpdated(id);
        SyncPhantomsForCard(id);
    }
    
    // 星级管理
    public void AddStar(string id, int delta)
    {
        var card = PlayerCardBank.I.Get(id);
        if (card == null || card.isPhantom) return;
        
        card.star = Mathf.Clamp(card.star + delta, 0, 15);
        NotifyUpdated(id);
        SyncPhantomsForCard(id);
    }
    
    // 封赏经验
    public void AddGiftExp(string id, int exp)
    {
        var card = PlayerCardBank.I.Get(id);
        if (card == null || card.isPhantom) return;
        
        card.giftExp += exp;
        card.giftLv = CalculateGiftLevelFromProgress(card.giftExp);
        
        // 更新装备槽解锁状态
        card.equip.weaponUnlocked = card.giftLv >= 1;
        card.equip.armorUnlocked = card.giftLv >= 2;
        card.equip.mountUnlocked = card.giftLv >= 3;
        
        NotifyUpdated(id);
    }
    
    // 事件广播
    public void BroadcastCardUpdated(string cardId)
    {
        onCardUpdated?.Invoke(cardId);
    }
}
```

## 数据库配置

### CardDatabaseStatic - 静态数据库

ScriptableObject资源，包含所有卡牌的静态配置。

```csharp
[CreateAssetMenu(fileName = "CardDatabaseStatic", menuName = "CardDB/Static Database")]
public class CardDatabaseStatic : ScriptableObject
{
    // 单例访问
    public static CardDatabaseStatic Instance =>
        _inst ??= Resources.Load<CardDatabaseStatic>("CardDatabaseStatic");
    
    // 数据表
    [SerializeField] private List<CardInfoStatic> cards = new();
    [SerializeField] private List<StarUpgradeRule> starTable = new();
    [SerializeField] private List<TierEntry> tierTable = new();
    
    // 运行时缓存
    Dictionary<string, CardInfoStatic> cardLookup;
    Dictionary<int, StarUpgradeRule> starLookup;
    Dictionary<Tier, float> tierLookup;
    
    // 查询方法
    public CardInfoStatic GetCard(string id)
    {
        return cardLookup?.TryGetValue(id, out var c) ? c : null;
    }
    
    public StarUpgradeRule GetStar(int level)
    {
        return starLookup?.TryGetValue(level, out var r) ? r : null;
    }
    
    public float GetTierMultiplier(Tier t)
    {
        return tierLookup?.TryGetValue(t, out var v) ? v : 1f;
    }
}
```

## 服务器数据转换

### CardService - 数据同步服务

```csharp
// 服务器返回的数据格式
[Serializable]
private class CardItem
{
    public string card_id;      // 卡牌ID
    public int level;           // 等级
    public int star;            // 星级
    public int gift_level;      // 封赏等级
    public int gift_progress;   // 封赏进度
    
    // 幻影卡
    public int is_phantom;      // 0=普通, 1=幻影
    public string clone_on;     // 复制目标
    public long expire_time;    // 过期时间
    
    // 装备
    public string weapon_id;    // 武器ID
    public string armor_id;     // 护甲ID
    public string horse_id;     // 坐骑ID
}

// 转换为本地格式
void AddOrUpdateCard(CardItem item)
{
    var playerCard = new PlayerCard
    {
        id = item.card_id,
        level = item.level,
        star = item.star,
        giftLv = item.gift_level,
        giftExp = item.gift_progress,
        isPhantom = item.is_phantom == 1,
        cloneOn = item.clone_on ?? "",
        expireTime = item.expire_time
    };
    
    // 设置装备槽解锁状态
    if (!playerCard.isPhantom)
    {
        playerCard.equip.weaponUnlocked = playerCard.giftLv >= 1;
        playerCard.equip.armorUnlocked = playerCard.giftLv >= 2;
        playerCard.equip.mountUnlocked = playerCard.giftLv >= 3;
    }
    
    PlayerCardBank.I.AddCard(playerCard);
}
```

## 使用示例

### 获取卡牌数据

```csharp
// 获取单张卡牌
var s1Card = PlayerCardBank.I.Get("S1");
var lordCard = PlayerCardBank.I.Get("LORD");

// 获取所有卡牌
var allCards = PlayerCardBank.I.cards;

// 筛选条件
var normalCards = allCards.Where(c => !c.isPhantom).ToList();
var sCards = allCards.Where(c => c.id.StartsWith("S")).ToList();
var maxLevelCards = allCards.Where(c => c.level >= 200).ToList();
```

### 监听数据变化

```csharp
void OnEnable()
{
    PlayerCardBankMgr.I.onCardUpdated += OnCardUpdated;
}

void OnDisable()
{
    PlayerCardBankMgr.I.onCardUpdated -= OnCardUpdated;
}

void OnCardUpdated(string cardId)
{
    if (cardId == currentCardId)
    {
        RefreshUI();
    }
}
```

## 数据验证

```csharp
// PlayerCardBank提供的数据验证
public bool ValidateData()
{
    // 检查lookup一致性
    if (_lookup == null || _lookup.Count != _cards.Count)
    {
        RebuildLookup();
        return false;
    }
    
    // 检查数据完整性
    foreach (var card in _cards)
    {
        if (string.IsNullOrEmpty(card.id))
        {
            Debug.LogError("Found card with empty ID!");
            return false;
        }
    }
    
    return true;
}
```

## 注意事项

1. **卡牌ID规范**
   - 普通卡：S1-S99, A1-A99, B1-B99
   - 主公卡：LORD
   - 服务器前缀：Card_S1

2. **数据同步时机**
   - 登录时全量同步
   - 操作后增量更新
   - 切换账号时重置

3. **幻影卡限制**
   - 不能修改level/star/giftLv
   - 属性跟随cloneOn目标
   - 需定期清理过期卡牌

4. **性能优化**
   - 使用Dictionary缓存查找
   - 批量更新减少事件触发
   - 定期重建索引确保一致性