---
id: card-equipment-system
title: 装备系统
sidebar_label: 装备系统
sidebar_position: 6
---

# 装备系统

## 系统概述

装备系统允许卡牌穿戴武器、护甲和坐骑三种装备，提升战斗属性。装备槽位通过封赏等级解锁，每个装备都可以独立升级强化。系统使用UUID管理装备实例，支持装备在不同卡牌间切换。

## 装备槽位

### 槽位类型

```csharp
public enum EquipSlotType 
{ 
    Weapon,   // 武器槽（封赏1级解锁）
    Armor,    // 护甲槽（封赏2级解锁）
    Mount     // 坐骑槽（封赏3级解锁）
}
```

### 解锁机制

```csharp
// EquipStatus.cs
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

## 装备数据模型

### 武器/护甲 - PlayerGear

```csharp
// GearDefinitions.cs
[Serializable]
public class PlayerGear
{
    public string uuid = "";         // 唯一标识符（UUID格式）
    public string staticId;          // 静态配置ID（如"weapon1"）
    public int level = 1;            // 强化等级
    public bool unlocked = true;     // 是否已解锁
    public string equippedById = ""; // 装备在哪个卡牌上
    
    // 生成UUID
    public void EnsureUuid()
    {
        if (string.IsNullOrEmpty(uuid))
            uuid = Guid.NewGuid().ToString("N");
    }
    
    // 获取静态配置
    public GearStatic Static => GearDatabaseStatic.Instance.Get(staticId);
}
```

### 坐骑 - PlayerHorse

```csharp
[Serializable]
public class PlayerHorse
{
    public string uuid = "";         // 唯一标识符
    public string staticId;          // 静态配置ID（如"horse1"）
    public int level = 1;            // 强化等级
    public bool unlocked = true;     // 是否已解锁
    public string equippedById = ""; // 装备在哪个卡牌上
    
    // 获取静态配置
    public HorseStatic Static => HorseDatabaseStatic.Instance.Get(staticId);
}
```

### 静态配置 - GearStatic

```csharp
[Serializable]
public class GearStatic
{
    [Header("标识")]
    public string id;               // 装备ID
    public string name;             // 装备名称
    public GearKind kind;           // 类型（武器/护甲）
    public Tier tier;               // 品质等级（S/A/B）
    
    [Header("数值倍率 (Atk / Def)")]
    public float[] valueMultiplier = new float[2];
    
    [Header("图标")]
    public Sprite iconSprite;       // 装备图标
    
    // 计算当前等级的属性
    public (float atk, float def) CalcStats(int level)
    {
        float coe = DB.GetValueCoe(tier);
        float pow = DB.GetValuePow(tier);
        float statBase = coe * Mathf.Pow(level, pow);
        
        return (statBase * valueMultiplier[0],
                statBase * valueMultiplier[1]);
    }
    
    // 计算升级材料需求
    public (int iron, int fineWood, int steel) CalcUpgradeCost(int level)
    {
        float iron = DB.GetIronCostCoe(tier) * Mathf.Pow(level, DB.GetIronCostPow(tier));
        float wood = level >= 10 
            ? DB.GetFineWoodCoe(tier) * Mathf.Pow(level, DB.GetFineWoodPow(tier))
            : 0;
        float steel = level >= 20
            ? DB.GetSteelCoe(tier) * Mathf.Pow(level, DB.GetSteelPow(tier))
            : 0;
            
        return (Mathf.CeilToInt(iron),
                Mathf.CeilToInt(wood),
                Mathf.CeilToInt(steel));
    }
}
```

### 静态配置 - HorseStatic

```csharp
[Serializable]
public class HorseStatic
{
    public string id;               // 战马ID
    public string name;             // 战马名称
    public Tier tier;               // 品质等级
    public Sprite iconSprite;       // 战马图标
    
    [Header("属性加成百分比")]
    public float[] valueMultiplier = new float[4]; // [攻击%, 防御%, 智力%, 统率%]
    
    // 计算当前等级的属性加成
    public (float atk, float def, float intel, float cmd) CalcStats(int level)
    {
        float coe = DB.GetValueCoe(tier);
        float pow = DB.GetValuePow(tier);
        float statBase = coe * Mathf.Pow(level, pow);
        
        return (statBase * valueMultiplier[0],
                statBase * valueMultiplier[1],
                statBase * valueMultiplier[2],
                statBase * valueMultiplier[3]);
    }
}
```

## 装备管理器

### PlayerGearBank - 装备仓库

```csharp
public class PlayerGearBank : SingletonMono<PlayerGearBank>
{
    // 装备列表
    private readonly List<PlayerGear> gears = new();
    private Dictionary<string, PlayerGear> uuid2Gear;
    
    // 事件
    public Action<string> onGearChanged;
    public Action<string> onGearUpdated;
    
    // 核心方法
    public PlayerGear Get(string uuid);              // 通过UUID获取
    public PlayerGear GetByStatic(string staticId);  // 通过静态ID获取
    public PlayerGear Add(string staticId, int level = 1);
    public PlayerGear AddWithUuid(string uuid, string staticId, int level = 1);
    public void Remove(string uuid);
    public void UpdateLevel(string uuid, int newLevel);
    public void MarkDirty(string uuid);
    public void Clear();
    
    // 属性
    public IEnumerable<PlayerGear> All => uuid2Gear?.Values ?? gears;
    public int Count => uuid2Gear?.Count ?? gears.Count;
}
```

### PlayerHorseBank - 战马仓库

```csharp
public class PlayerHorseBank : SingletonMono<PlayerHorseBank>
{
    private readonly List<PlayerHorse> horses = new();
    private Dictionary<string, PlayerHorse> uuid2Horse;
    
    // 类似PlayerGearBank的接口
    public PlayerHorse Get(string uuid);
    public void Add(PlayerHorse horse);
    public void Remove(string uuid);
    public void MarkDirty(string uuid);
    public void Clear();
    
    public IEnumerable<PlayerHorse> All => horses;
}
```

## 装备操作

### EquipmentManager - 统一管理器

```csharp
public static class EquipmentManager
{
    // 装备武器/护甲
    public static void Equip(
        PlayerCard hero,
        PlayerGear gear,
        EquipSlotType slot,
        PlayerCardBank cardBank,
        PlayerGearBank gearBank)
    {
        if (hero == null || gear == null) return;
        
        // 1. 如果装备在别人身上，先卸下
        if (!string.IsNullOrEmpty(gear.equippedById) && 
            gear.equippedById != hero.id)
        {
            var oldHero = cardBank.Get(gear.equippedById);
            if (oldHero != null)
                ClearSlot(oldHero, slot, gearBank);
        }
        
        // 2. 卸下英雄当前装备
        ClearSlot(hero, slot, gearBank);
        
        // 3. 穿上新装备
        switch (slot)
        {
            case EquipSlotType.Weapon:
                hero.equip.weaponUuid = gear.uuid;
                break;
            case EquipSlotType.Armor:
                hero.equip.armorUuid = gear.uuid;
                break;
            case EquipSlotType.Mount:
                hero.equip.accessoryUuid = gear.uuid;
                break;
        }
        gear.equippedById = hero.id;
        
        // 4. 触发更新
        gearBank.MarkDirty(gear.uuid);
        PlayerCardBankMgr.I?.RaiseCardUpdated(hero.id);
    }
    
    // 装备战马
    public static void Equip(
        PlayerCard hero,
        PlayerHorse horse,
        EquipSlotType slot,  // 必须是Mount
        PlayerCardBank cardBank,
        PlayerHorseBank horseBank)
    {
        if (hero == null || horse == null || slot != EquipSlotType.Mount) 
            return;
        
        // 类似流程...
        hero.equip.accessoryUuid = horse.uuid;
        horse.equippedById = hero.id;
        horseBank.MarkDirty(horse.uuid);
        PlayerCardBankMgr.I?.RaiseCardUpdated(hero.id);
    }
    
    // 卸下装备
    public static void ClearSlot(
        PlayerCard hero,
        EquipSlotType slot,
        PlayerGearBank gearBank = null)
    {
        if (hero == null) return;
        
        string oldUuid = "";
        switch (slot)
        {
            case EquipSlotType.Weapon:
                oldUuid = hero.equip.weaponUuid;
                hero.equip.weaponUuid = "";
                break;
            case EquipSlotType.Armor:
                oldUuid = hero.equip.armorUuid;
                hero.equip.armorUuid = "";
                break;
            case EquipSlotType.Mount:
                oldUuid = hero.equip.accessoryUuid;
                hero.equip.accessoryUuid = "";
                break;
        }
        
        if (gearBank != null && !string.IsNullOrEmpty(oldUuid))
        {
            var g = gearBank.Get(oldUuid);
            if (g != null)
            {
                g.equippedById = "";
                gearBank.MarkDirty(oldUuid);
            }
        }
    }
}
```

## UI实现

### CardEquipmentManager - 卡牌装备管理UI

```csharp
public class CardEquipmentManager : MonoBehaviour
{
    // UI元素
    private Button weaponSlot;
    private Button armorSlot;
    private Button mountSlot;
    
    // 数据
    private CardInfoStatic currentStatic;
    private PlayerCard currentDynamic;
    
    // 刷新装备显示
    public void RefreshEquipment()
    {
        if (currentDynamic == null) return;
        
        // 获取装备数据
        var weaponData = GetEquipmentData(currentDynamic.equip.weaponUuid, EquipSlotType.Weapon);
        var armorData = GetEquipmentData(currentDynamic.equip.armorUuid, EquipSlotType.Armor);
        var mountData = GetEquipmentData(currentDynamic.equip.accessoryUuid, EquipSlotType.Mount);
        
        // 更新槽位显示
        UpdateEquipSlotVisual(0, weaponData, currentDynamic.equip.weaponUnlocked);
        UpdateEquipSlotVisual(1, armorData, currentDynamic.equip.armorUnlocked);
        UpdateEquipSlotVisual(2, mountData, currentDynamic.equip.mountUnlocked);
    }
    
    // 处理槽位点击
    private void HandleSlotClick(EquipSlotType slot)
    {
        if (currentDynamic == null)
        {
            PopupManager.Show("提示", "尚未拥有该武将");
            return;
        }
        
        // 检查槽位是否解锁
        bool unlocked = IsSlotUnlocked(slot);
        if (!unlocked)
        {
            PopupManager.Show("提示", "该装备槽未解锁");
            return;
        }
        
        // 打开装备选择面板
        if (slot == EquipSlotType.Mount)
        {
            horsePanel?.Open(currentDynamic);
        }
        else
        {
            gearPanel?.Open(currentDynamic, slot);
        }
    }
}
```

### 装备选择面板

```csharp
public class GearSelectionPanel : MonoBehaviour
{
    // 筛选可装备的装备
    private List<PlayerGear> GetAvailableGears(EquipSlotType slot)
    {
        var allGears = PlayerGearBank.I.All;
        var filtered = new List<PlayerGear>();
        
        foreach (var gear in allGears)
        {
            var gearStatic = gear.Static;
            if (gearStatic == null) continue;
            
            // 根据槽位筛选类型
            bool matchesSlot = slot switch
            {
                EquipSlotType.Weapon => gearStatic.kind == GearKind.Weapon,
                EquipSlotType.Armor => gearStatic.kind == GearKind.Armor,
                _ => false
            };
            
            if (matchesSlot)
            {
                filtered.Add(gear);
            }
        }
        
        // 排序：未装备的优先，品质高的优先
        filtered.Sort((a, b) =>
        {
            // 未装备的排前面
            bool aEquipped = !string.IsNullOrEmpty(a.equippedById);
            bool bEquipped = !string.IsNullOrEmpty(b.equippedById);
            if (aEquipped != bEquipped)
                return aEquipped ? 1 : -1;
            
            // 品质高的排前面
            return b.Static.tier.CompareTo(a.Static.tier);
        });
        
        return filtered;
    }
}
```

## 装备升级

### 升级材料需求

```csharp
// 计算升级材料
public (int iron, int fineWood, int steel) CalcUpgradeCost(int level)
{
    // 基础材料：铁（任何等级都需要）
    float iron = DB.GetIronCostCoe(tier) * Mathf.Pow(level, DB.GetIronCostPow(tier));
    
    // 10级以上需要精木
    float wood = level >= 10
        ? DB.GetFineWoodCoe(tier) * Mathf.Pow(level, DB.GetFineWoodPow(tier))
        : 0;
    
    // 20级以上需要精钢
    float steel = level >= 20
        ? DB.GetSteelCoe(tier) * Mathf.Pow(level, DB.GetSteelPow(tier))
        : 0;
    
    return (Mathf.CeilToInt(iron),
            Mathf.CeilToInt(wood),
            Mathf.CeilToInt(steel));
}
```

### 升级流程

```csharp
void OnUpgradeClicked()
{
    if (selectedGear == null) return;
    
    // 1. 计算材料需求
    var (iron, wood, steel) = selectedGear.Static.CalcUpgradeCost(selectedGear.level + 1);
    
    // 2. 检查材料
    long currentIron = InventoryService.I.GetItemCount("RawIron");
    long currentWood = InventoryService.I.GetItemCount("Firmwood");
    long currentSteel = InventoryService.I.GetItemCount("IronIngot");
    
    if (currentIron < iron || currentWood < wood || currentSteel < steel)
    {
        PopupManager.Show("材料不足", "升级所需材料不足");
        return;
    }
    
    // 3. 发送升级请求
    var request = new UpgradeGearRequest(selectedGear.uuid);
    MessageHub.I.Request("gear/upgrade", request, OnUpgradeResponse, 10f);
}
```

## 网络同步

### 装备/卸载请求

```csharp
[Serializable]
public class ChangeGearRequest
{
    public string gear_uuid;      // 装备UUID
    public string equip_on_card;  // 目标卡牌ID（空字符串表示卸载）
    public int unload;           // 1=卸载，0=装备
}
```

### 装备/卸载响应

```csharp
[Serializable]
public class ChangeGearResponse
{
    public string target_gear_unequip_from;    // 装备从哪个卡牌卸下
    public string target_gear_equip_on;        // 装备到哪个卡牌
    public string new_card_old_gear_removed;   // 新卡牌的旧装备UUID
}
```

### 升级请求

```csharp
[Serializable]
public class UpgradeGearRequest
{
    public string gear_uuid;
}
```

### 升级响应

```csharp
[Serializable]
public class UpgradeResponse
{
    public GearInfo gear_info;                    // 装备新信息
    public Dictionary<string, long> current_balance; // 材料余额
}

[Serializable]
public class GearInfo
{
    public string gear_uuid;
    public int gear_level;
    public string on_card;
}
```

## 数据同步服务

### GearService - 装备数据服务

```csharp
public class GearService : SingletonMono<GearService>
{
    public bool IsInited { get; private set; }
    public Action OnGearDataReady;
    
    // 初始化获取所有装备
    public void Init()
    {
        MessageHub.I.Request("gear/get_gear", null, OnGetGearResp, 10f);
    }
    
    // 处理服务器数据
    void ProcessGearData(List<GearItem> gearList)
    {
        // 清空现有数据
        PlayerGearBank.I?.Clear();
        PlayerHorseBank.I?.Clear();
        
        // 分类处理
        foreach (var item in gearList)
        {
            if (item.gear_id.StartsWith("horse"))
            {
                // 添加到战马库
                var horse = new PlayerHorse
                {
                    uuid = item.gear_uuid,
                    staticId = item.gear_id,
                    level = item.gear_level,
                    equippedById = item.on_card
                };
                PlayerHorseBank.I.Add(horse);
            }
            else if (item.gear_id.StartsWith("weapon") || 
                     item.gear_id.StartsWith("armor"))
            {
                // 添加到装备库
                var gear = PlayerGearBank.I.AddWithUuid(
                    item.gear_uuid, 
                    item.gear_id, 
                    item.gear_level
                );
                gear.equippedById = item.on_card;
            }
        }
    }
}
```

### CardService中的装备处理

```csharp
// 从服务器卡牌数据转换装备UUID
private string FindGearUuid(string gearId, string cardId, string gearType)
{
    if (string.IsNullOrEmpty(gearId)) return "";
    
    // 如果已经是UUID格式，直接返回
    if (gearId.Contains("-")) return gearId;
    
    // 根据类型查找对应的装备
    if (gearType == "weapon" || gearType == "armor")
    {
        // 查找装备在该卡牌上的装备
        var gear = PlayerGearBank.I?.All.FirstOrDefault(g => 
            g.staticId == gearId && g.equippedById == cardId);
        
        // 如果找不到，尝试找未装备的
        if (gear == null)
        {
            gear = PlayerGearBank.I?.All.FirstOrDefault(g => 
                g.staticId == gearId && string.IsNullOrEmpty(g.equippedById));
            
            if (gear != null)
            {
                // 标记为已装备
                gear.equippedById = cardId;
                PlayerGearBank.I?.MarkDirty(gear.uuid);
            }
        }
        
        return gear?.uuid ?? "";
    }
    else if (gearType == "horse")
    {
        // 类似处理战马
        var horse = PlayerHorseBank.I?.All.FirstOrDefault(h => 
            h.staticId == gearId && h.equippedById == cardId);
        return horse?.uuid ?? "";
    }
    
    return "";
}
```

## 特殊规则

### 1. 主公卡装备

```csharp
// 主公卡的装备槽默认全部解锁
if (cardId == "LORD")
{
    lordCard.equip.weaponUnlocked = true;
    lordCard.equip.armorUnlocked = true;
    lordCard.equip.mountUnlocked = true;
}
```

### 2. 幻影卡限制

```csharp
// 幻影卡不能装备道具
if (pc.isPhantom)
{
    Debug.LogWarning($"Cannot equip on phantom card {id}");
    return;
}
```

### 3. 装备唯一性

- 一件装备同时只能装备在一个卡牌上
- 切换装备时自动从原卡牌卸下

### 4. UUID管理

- 每件装备有唯一的UUID标识
- 服务器返回的装备使用UUID而非静态ID
- 本地缓存UUID与装备实例的映射关系

## 注意事项

1. **UUID转换**
   - 服务器可能返回静态ID或UUID
   - 需要正确转换和查找对应装备实例

2. **装备状态同步**
   - 装备/卸载操作需要同步到服务器
   - 本地立即更新，服务器确认后最终生效

3. **UI刷新**
   - 装备变化后触发onGearUpdated事件
   - 卡牌装备变化触发onCardUpdated事件

4. **材料消耗**
   - 升级材料从InventoryService获取
   - 根据等级阶段需要不同材料

5. **性能优化**
   - 使用Dictionary缓存UUID映射
   - 批量更新减少UI刷新次数

## 相关文档

- [卡牌系统概述](./card-overview.md)
- [封赏系统](./card-gift-system.md)
- [升级系统](./card-upgrade-system.md)
- [数据同步服务](./card-service.md)