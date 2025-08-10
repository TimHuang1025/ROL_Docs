---
id: card-gift-system
title: 封赏系统
sidebar_label: 封赏系统
sidebar_position: 4
---

# 封赏系统

## 系统概述

封赏系统是卡牌养成的重要维度，通过赠送礼物提升卡牌的封赏等级（0-3级），每个等级解锁对应的装备槽位。系统支持多种礼物类型，每种礼物提供不同的经验值。

## 封赏等级

### 等级定义

| 等级 | 名称 | 累计经验阈值 | 解锁内容 |
|------|------|-------------|---------|
| 0 | 未封赏 | 0 | - |
| 1 | 拜将 | 500 | 武器槽 |
| 2 | 授甲 | 5500 | 护甲槽 |
| 3 | 赐骑 | 20500 | 坐骑槽 |

### 数据结构

```csharp
// PlayerCard.cs
public class PlayerCard
{
    // 封赏系统
    public int giftLv = 0;      // 封赏等级 0-3
    public int giftExp = 0;     // 累计封赏经验值
    
    // 装备槽位
    public EquipStatus equip = new();
    
    // 辅助属性
    public string GiftLevelName
    {
        get
        {
            switch (giftLv)
            {
                case 0: return "未封赏";
                case 1: return "拜将";
                case 2: return "授甲";
                case 3: return "赐骑";
                default: return "封侯";
            }
        }
    }
    
    public bool IsMaxGiftLevel => giftLv >= 3;
}
```

## 礼物系统

### 礼物类型与经验值

```csharp
// GiftPanelUI.cs
private static readonly Dictionary<string, int> GIFT_VALUES = new Dictionary<string, int>
{
    { "Gift_dessert", 50 },      // 糕点
    { "Gift_wine", 100 },         // 美酒
    { "Gift_silk", 200 },         // 丝绸
    { "Gift_sword", 500 },        // 佩刀
    { "Gift_painting", 1000 },    // 字画
    { "Gift_jade", 1500 },        // 玉石
    { "Gift_porcelain", 2000 },   // 瓷器
    { "Gift_pearl", 2500 },       // 珍珠（如果有）
    { "Gift_field", 3000 },       // 良田（如果有）
    { "Gift_house", 5000 },       // 住宅（如果有）
};
```

### 礼物获取途径

| 来源 | 说明 |
|------|------|
| **商店购买** | 使用资源购买礼物 |
| **任务奖励** | 完成任务获得 |
| **活动奖励** | 参与活动获得 |
| **测试获取** | test/GetItem接口（仅开发环境） |

## 装备槽解锁机制

### EquipStatus - 装备状态

```csharp
[Serializable]
public class EquipStatus
{
    // 装备UUID
    public string weaponUuid = "";      // 武器的UUID
    public string armorUuid = "";       // 护甲的UUID
    public string accessoryUuid = "";   // 坐骑的UUID
    
    // 槽位解锁状态
    public bool weaponUnlocked = false;   // 武器槽是否解锁（封赏1级）
    public bool armorUnlocked = false;    // 护甲槽是否解锁（封赏2级）
    public bool mountUnlocked = false;    // 坐骑槽是否解锁（封赏3级）
    
    // 根据封赏等级更新槽位解锁状态
    public void UpdateUnlockStatus(int giftLevel)
    {
        weaponUnlocked = giftLevel >= 1;
        armorUnlocked = giftLevel >= 2;
        mountUnlocked = giftLevel >= 3;
    }
}
```

### 解锁规则

```csharp
// PlayerCardBankMgr.cs
public void AddGiftExp(string id, int exp)
{
    var pc = PlayerCardBank.I.Get(id);
    if (pc == null || exp <= 0) return;
    
    // 幻影卡不能升级礼物
    if (pc.isPhantom)
    {
        Debug.LogWarning($"Cannot add gift exp to phantom card {id}");
        return;
    }
    
    // 添加经验值（累加到总进度）
    int oldExp = pc.giftExp;
    pc.giftExp += exp;
    
    // 根据总进度计算新等级
    int oldLevel = pc.giftLv;
    pc.giftLv = CalculateGiftLevelFromProgress(pc.giftExp);
    
    // 限制最高等级
    if (pc.giftLv > 3) pc.giftLv = 3;
    
    // 如果等级提升了，更新装备槽解锁状态
    if (pc.giftLv != oldLevel)
    {
        pc.equip.weaponUnlocked = pc.giftLv >= 1;  // 1级解锁武器
        pc.equip.armorUnlocked = pc.giftLv >= 2;   // 2级解锁护甲
        pc.equip.mountUnlocked = pc.giftLv >= 3;   // 3级解锁坐骑
    }
    
    // 触发更新事件
    NotifyUpdated(id);
}

// 根据总进度计算等级
private int CalculateGiftLevelFromProgress(int totalProgress)
{
    if (totalProgress >= 20500) return 3;
    if (totalProgress >= 5500) return 2;
    if (totalProgress >= 500) return 1;
    return 0;
}
```

## GiftPanel UI实现

### UI结构

```
GiftPanel/
├── GiftTitle              # 标题栏
│   ├── ClosePanel        # 关闭按钮
│   └── Title             # "赏赐"标题
├── HeroGiftInfo          # 英雄礼物信息
│   ├── HeroGiftLv        # 当前等级显示
│   └── HeroGiftProgress  # 经验进度条
├── GiftList              # 礼物列表（ScrollViewPro）
│   └── GiftOption[]      # 礼物选项
│       ├── GiftIcon      # 礼物图标
│       ├── GiftName      # 礼物名称
│       ├── GiftValue     # 经验值
│       └── GiftStock     # 库存数量
├── EquipSlots            # 装备槽位显示
│   ├── weaponslot        # 武器槽
│   ├── armorslot         # 护甲槽
│   └── horseslot         # 坐骑槽
└── SendGiftBtn           # 赠送按钮
```

### GiftPanelController - 主控制器

```csharp
public class GiftPanelController : MonoBehaviour, IUIPanelController
{
    // 数据引用
    CardInfoStatic info;      // 静态信息
    PlayerCard dyn;           // 动态信息
    
    // UI组件
    [SerializeField] private UnitGiftLevel giftLevelUI;
    [SerializeField] private VisualTreeAsset giftOptionTpl;
    [SerializeField] private string optionContainerName = "GiftList";
    
    // 运行时状态
    private ScrollViewPro optionContainer;
    private readonly List<Entry> entries = new();
    private Entry selectedEntry;
    private int sendCount = 1;
    
    // 排序模式
    private enum SortMode { StockDesc, ValueDesc }
    private SortMode currentSort = SortMode.StockDesc;
}
```

### 礼物选择逻辑

```csharp
void OnSelectGift(Entry e)
{
    if (e == selectedEntry) return;
    
    // 取消之前的选中
    if (selectedEntry != null)
    {
        selectedEntry.root.RemoveFromClassList("item-slot-selected");
        selectedEntry.root.style.backgroundColor = new Color(201/255f, 184/255f, 162/255f, 1f);
        selectedEntry.root.style.borderLeftWidth = 0;
    }
    
    // 设置新的选中
    selectedEntry = e;
    sendCount = 1;
    
    // 添加选中样式
    e.root.AddToClassList("item-slot-selected");
    e.root.style.backgroundColor = new Color(185/255f, 168/255f, 146/255f, 1f);
    e.root.style.borderLeftWidth = 10;
    e.root.style.borderLeftColor = new Color(139/255f, 111/255f, 78/255f, 1f);
}
```

### 赠送流程

```csharp
void OnConfirmGift()
{
    // 1. 检查条件
    if (selectedEntry == null || selectedEntry.data.stock < sendCount)
    {
        PopupManager.Show("提示", "请选择礼物或库存不足");
        return;
    }
    
    // 2. 检查幻影卡
    if (dyn.isPhantom)
    {
        PopupManager.Show("提示", "幻影卡无法接受封赏");
        return;
    }
    
    // 3. 构建请求
    var requestData = new GiftRequest
    {
        card_id = dyn.id,
        gift_item_id = selectedEntry.itemId,
        amount = sendCount
    };
    
    // 4. 发送请求
    MessageHub.I.Request("card/give_gift", requestData, OnGiftResponse, 10f);
}
```

### UnitGiftLevel - 等级显示组件

```csharp
public class UnitGiftLevel : MonoBehaviour
{
    // 数据
    private CardInfoStatic info;
    private PlayerCard dyn;
    
    // UI元素
    Label levelLabel;            // 等级文字
    ProgressBar expBar;          // 经验条
    VisualElement weaponslot;    // 武器槽
    VisualElement armorslot;     // 护甲槽
    VisualElement horseslot;     // 坐骑槽
    
    // 常量表
    public static readonly int[] Need = { 0, 500, 5500, 20500 };
    public static readonly string[] LvTxt = { "", "拜将", "授甲", "赐骑", "封侯" };
    
    public void RefreshUI()
    {
        int lv = dyn?.giftLv ?? 0;
        int exp = dyn?.giftExp ?? 0;
        
        // 等级文字
        levelLabel.text = lv > 0 && lv < LvTxt.Length ? LvTxt[lv] : "未封赏";
        
        // 经验条百分比计算
        float pct = 0f;
        if (lv >= 3)  // 满级
        {
            pct = 1f;
        }
        else if (lv == 0)
        {
            pct = (float)exp / Need[1];
        }
        else
        {
            int prevThreshold = Need[lv];
            int nextThreshold = Need[lv + 1];
            int levelRange = nextThreshold - prevThreshold;
            pct = (float)(exp - prevThreshold) / levelRange;
        }
        
        expBar.value = pct * 100f;
        expBar.title = lv >= 3 ? "MAX" : $"{exp - Need[lv]}/{Need[lv + 1] - Need[lv]}";
        
        // 刷新装备槽
        RefreshEquipSlots();
    }
    
    public void RefreshEquipSlots()
    {
        int lv = dyn?.giftLv ?? 0;
        
        // 幻影卡使用复制目标的封赏等级
        if (dyn.isPhantom && !string.IsNullOrEmpty(dyn.cloneOn))
        {
            var cloneTarget = PlayerCardBank.I.Get(dyn.cloneOn);
            if (cloneTarget != null) lv = cloneTarget.giftLv;
        }
        
        // 根据等级解锁槽位
        SetSlotLocked(weaponslot, lv < 1);
        SetSlotLocked(armorslot, lv < 2);
        SetSlotLocked(horseslot, lv < 3);
    }
}
```

## 网络协议

### 赠送礼物请求

```csharp
[Serializable]
public class GiftRequest
{
    public string card_id;        // 卡牌ID
    public string gift_item_id;   // 礼物道具ID
    public int amount;            // 赠送数量
}
```

### 赠送礼物响应

```csharp
[Serializable]
public class GiftResponseData
{
    public Dictionary<string, int> card_gift_level;      // 新的封赏等级
    public Dictionary<string, int> card_gift_progress;   // 新的封赏进度
    public Dictionary<string, long> current_balance;     // 物品余额更新
}
```

### 错误码

| 错误码 | 说明 | 处理方式 |
|--------|------|---------|
| 400 | 参数错误 | 显示错误提示 |
| 401 | 未认证 | 提示重新登录 |
| 402 | 物品不足 | 显示所需和当前数量 |
| 403 | 等级已满 | 提示封赏等级已达上限 |
| 404 | 卡牌不存在或是幻影卡 | 提示无法赠送 |

## 数据同步

### 服务器数据更新

```csharp
void ProcessGiftSuccess(GiftResponseData data)
{
    // 1. 更新卡片的封赏等级和进度
    if (data.card_gift_level != null && data.card_gift_progress != null)
    {
        foreach (var kvp in data.card_gift_level)
        {
            string cardId = kvp.Key;
            int newLevel = kvp.Value;
            int newProgress = data.card_gift_progress.ContainsKey(cardId) 
                ? data.card_gift_progress[cardId] : 0;
            
            // 使用CardService更新
            if (CardService.I != null)
            {
                CardService.I.UpdateCardGiftLevel(cardId, newLevel, newProgress);
            }
            else
            {
                // 直接更新PlayerCardBank
                var card = PlayerCardBank.I?.Get(cardId);
                if (card != null)
                {
                    card.giftLv = newLevel;
                    card.giftExp = newProgress;
                    
                    // 更新装备槽解锁状态
                    card.equip.weaponUnlocked = newLevel >= 1;
                    card.equip.armorUnlocked = newLevel >= 2;
                    card.equip.mountUnlocked = newLevel >= 3;
                    
                    PlayerCardBankMgr.I.BroadcastCardUpdated(cardId);
                }
            }
        }
    }
    
    // 2. 更新物品余额
    if (data.current_balance != null)
    {
        var updates = new Dictionary<string, long>();
        foreach (var kvp in data.current_balance)
        {
            updates[kvp.Key] = kvp.Value;
        }
        InventoryService.I?.UpdateFromCurrentBalance(updates, "gift_given");
    }
}
```

## 特殊规则

### 1. 幻影卡限制

```csharp
// 幻影卡不能接受封赏
if (pc.isPhantom)
{
    Debug.LogWarning($"Cannot add gift exp to phantom card {id}");
    return;
}
```

### 2. 幻影卡同步

```csharp
// 如果有幻影卡复制了这张卡，同步更新幻影卡
if (!string.IsNullOrEmpty(pc.clonedBy))
{
    var phantomCard = PlayerCardBank.I.Get(pc.clonedBy);
    if (phantomCard != null && phantomCard.isPhantom)
    {
        phantomCard.giftLv = pc.giftLv;
        phantomCard.giftExp = pc.giftExp;
        phantomCard.equip.weaponUnlocked = pc.equip.weaponUnlocked;
        phantomCard.equip.armorUnlocked = pc.equip.armorUnlocked;
        phantomCard.equip.mountUnlocked = pc.equip.mountUnlocked;
        
        NotifyUpdated(pc.clonedBy);
    }
}
```

### 3. 满级处理

```csharp
void CheckMaxGiftLevel()
{
    if (dyn.giftLv >= 3)
    {
        // 满级后的UI处理
        confirmBtn.SetEnabled(false);
        confirmBtn.text = "已满级";
        expBar.title = "MAX";
        expBar.value = 100f;
    }
}
```

## UI样式

### 装备槽样式

```css
/* 未解锁状态 */
.locked {
    opacity: 0.3;
    -unity-background-image-tint-color: rgba(100, 100, 100, 0.5);
}

/* 已解锁状态 */
.unlocked {
    opacity: 1;
    -unity-background-image-tint-color: white;
}

/* 选中的礼物项 */
.item-slot-selected {
    background-color: rgba(185, 168, 146, 1);
    border-left-width: 10px;
    border-left-color: rgba(139, 111, 78, 1);
}
```

## 礼物库存管理

### 从InventoryService获取礼物

```csharp
private List<GiftData> GetGiftItemsFromInventory()
{
    var giftItems = new List<GiftData>();
    
    var itemDB = Game.Data.ItemDatabaseStatic.Instance;
    if (itemDB == null || InventoryService.I == null) return giftItems;
    
    foreach (var kvp in GIFT_VALUES)
    {
        string itemId = kvp.Key;
        int value = kvp.Value;
        
        // 从库存服务获取数量
        long stock = InventoryService.I.GetItemCount(itemId);
        
        // 从物品数据库获取显示信息
        var itemInfo = itemDB.Get(itemId);
        if (itemInfo == null) continue;
        
        var giftData = new GiftData
        {
            name = itemInfo.itemName,
            icon = itemInfo.icon,
            value = value,
            stock = (int)stock
        };
        
        giftItems.Add(giftData);
    }
    
    return giftItems;
}
```

## 注意事项

1. **经验计算**
   - 使用累计经验值，而非当前等级经验
   - 服务器返回的是总进度值，不是增量

2. **装备槽解锁**
   - 封赏等级提升时自动解锁对应槽位
   - 幻影卡显示复制目标的解锁状态

3. **礼物库存**
   - 实时从InventoryService获取
   - 库存不足时按钮禁用或显示遮罩

4. **UI刷新时机**
   - 赠送成功后立即刷新
   - 监听onCardUpdated事件
   - 切换卡牌时重新加载

5. **错误处理**
   - 网络请求失败重试机制
   - 详细的错误码处理
   - 友好的错误提示

## 相关文档

- [卡牌系统概述](./card-overview.md)
- [卡牌数据模型](./card-data-model.md)
- [装备系统](./card-equipment-system.md)
- [幻影卡系统](./phantom-card-system.md)