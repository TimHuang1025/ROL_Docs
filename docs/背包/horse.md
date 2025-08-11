# 坐骑系统文档

## 功能概述
坐骑系统允许玩家为英雄装备战马，提供攻击、防御和智力属性加成。系统包含坐骑获取、升级、装备和管理功能。

## 数据结构

### 坐骑静态数据
```csharp
// 文件：Assets/Scripts/Player/PlayerItems/PlayerHorse/HorseDefinitions.cs
public enum HorseTier { S, A, B }

[Serializable]
public class HorseStatic
{
    public string id;           // 坐骑ID (如: horse_1)
    public string name;         // 坐骑名称
    public HorseTier tier;      // 坐骑等级 S/A/B
    public float[] valueMultiplier = new float[3];  // 攻击/防御/智力倍率
    public Sprite iconSprite;   // 图标
    
    // 计算属性值
    public (float atk, float def, float cmd) CalcStats(int level)
    {
        float coe = DB.GetValueCoe(tier);
        float pow = DB.GetValuePow(tier);
        float baseVal = coe * Mathf.Pow(level, pow);
        return (baseVal * valueMultiplier[0],
                baseVal * valueMultiplier[1],
                baseVal * valueMultiplier[2]);
    }
    
    // 计算升级消耗
    public int CalcUpgradeCost(int level)
    {
        float coe = DB.GetCostCoe(tier);
        float pow = DB.GetCostPow(tier);
        return Mathf.CeilToInt(coe * Mathf.Pow(level, pow));
    }
}
```

### 坐骑动态数据
```csharp
// 文件：Assets/Scripts/Player/PlayerItems/PlayerHorse/HorseDefinitions.cs
[Serializable]
public class PlayerHorse
{
    public string uuid = "";         // 唯一标识符
    public string staticId;          // 对应静态数据ID
    public int level = 1;            // 当前等级 (1-50)
    public bool unlocked = true;     // 是否已解锁
    public string equippedById = ""; // 装备此坐骑的英雄ID
    
    public HorseStatic Static => HorseDatabaseStatic.Instance.Get(staticId);
}
```

### 坐骑数据库配置
```csharp
// 文件：Assets/Resources/GameDB/HorseStaticDB.asset
// 包含9种坐骑：
// S级：赤兔(horse_1)、玉兰白龙驹(horse_4)、快航(horse_7)
// A级：的卢(horse_2)、飞电(horse_5)、汗血(horse_8)  
// B级：绝影(horse_3)、踏雪(horse_6)、青风(horse_9)
```

## 坐骑管理系统

### PlayerHorseBank - 坐骑背包管理
```csharp
// 文件：Assets/Scripts/Player/PlayerItems/PlayerHorse/PlayerHorseBank.cs
[CreateAssetMenu(menuName = "GameDB/PlayerHorseBank")]
public class PlayerHorseBank : ScriptableObject
{
    // 单例访问
    public static PlayerHorseBank I { get; private set; }
    
    // 事件
    public event Action<string> onHorseChanged;   // 新增/删除
    public event Action<string> onHorseUpdated;   // 字段变更
    
    // 核心方法
    public PlayerHorse Get(string uuid);          // 通过UUID获取坐骑
    public IEnumerable<PlayerHorse> All;          // 获取所有坐骑
    public void Clear();                          // 清空所有坐骑
    public PlayerHorse AddWithUuid(string uuid, string staticId, int level);
    public void UpdateLevel(string uuid, int newLevel);
    public void MarkDirty(string uuid);          // 标记数据变动
}
```

## 坐骑装备系统

### EquipmentManager - 装备管理器
```csharp
// 文件：Assets/Scripts/Player/PlayerItems/PlayerGear/EquipmentManager.cs
public static class EquipmentManager
{
    // 装备战马
    public static void Equip(
        PlayerCard       hero,
        PlayerHorse      horse,
        EquipSlotType    slot,        // 必须传 Mount
        PlayerCardBank   cardBank,
        PlayerHorseBank  horseBank)
    {
        // 1) 卸下马匹原先的主人
        if (!string.IsNullOrEmpty(horse.equippedById) &&
            horse.equippedById != hero.id)
        {
            var oldHero = cardBank.Get(horse.equippedById);
            if (oldHero != null)
                ClearMount(oldHero, horseBank);
        }
        
        // 2) 卸下英雄当前坐骑
        ClearMount(hero, horseBank);
        
        // 3) 穿上新马
        hero.equip.accessoryUuid = horse.uuid;
        horse.equippedById = hero.id;
        
        // 4) 标记脏并存档
        horseBank.MarkDirty(horse.uuid);
        
        // 5) 通知UI更新
        PlayerCardBankMgr.I?.RaiseCardUpdated(hero.id);
    }
    
    // 卸下坐骑
    public static void ClearMount(
        PlayerCard hero,
        PlayerHorseBank horseBank)
    {
        // 实现卸载逻辑
    }
}
```

### 装备槽解锁条件
```csharp
// 文件：Assets/Scripts/Network/Core/Service/CardService.cs
// 坐骑槽位需要英雄封赏等级达到3级
playerCard.equip.mountUnlocked = playerCard.giftLv >= 3;
```

## 坐骑升级界面

### UI结构 - HorseUpgradePage.uxml
```xml
<!-- 文件：Assets/Scripts/Player/PlayerItems/PlayerHorse/UpgradePage/HorseUpgradePage.uxml -->
<ui:UXML>
    <ui:VisualElement name="HorseUpgradeRoot">
        <!-- 顶部导航栏 -->
        <ui:VisualElement name="TopSection" style="height: 12%;">
            <ui:Button name="ReturnBtn" text="返回" style="width: 155px; height: 97px; font-size: 46px;"/>
            <ui:Label name="Title" text="坐骑升级" style="font-size: 64px;"/>
        </ui:VisualElement>
        
        <!-- 主内容区 -->
        <ui:VisualElement name="MainContent" style="flex-direction: row;">
            <!-- 左侧坐骑列表 -->
            <ui:VisualElement name="ItemsArea">
                <!-- 排序按钮 -->
                <ui:Button name="SortBtn" text="阶级" style="font-size: 85%;"/>
                <!-- 坐骑列表（使用ScrollViewPro） -->
                <ScrollViewPro name="HorseListView" mode="Vertical"/>
            </ui:VisualElement>
            
            <!-- 右侧详情面板 -->
            <ui:VisualElement name="DetailPanel" style="width: 35%;">
                <!-- 坐骑信息 -->
                <ui:VisualElement name="HorseInfo">
                    <ui:VisualElement name="HorseIcon" style="width: 120px; height: 120px;"/>
                    <ui:Label name="HorseName" text="坐骑名称" style="font-size: 48px;"/>
                    <ui:Label name="HorseLevel" text="等级 1 / 50" style="font-size: 36px;"/>
                </ui:VisualElement>
                
                <!-- 装备信息 -->
                <ui:VisualElement name="EquippedInfo">
                    <ui:Label text="装备中:" style="font-size: 34px;"/>
                    <ui:Button name="EquippedCardButton"/>
                </ui:VisualElement>
                
                <!-- 属性显示 -->
                <ui:Label name="HorseStats" text="当前属性" style="font-size: 36px;"/>
                <ui:Label name="NextLevelStats" text="升级后" style="font-size: 36px;"/>
                
                <!-- 材料消耗 -->
                <ui:VisualElement name="MaterialPanel">
                    <ui:Label name="PlayerMaterialNum"/>
                    <ui:Label name="UpgradeMaterialNum"/>
                </ui:VisualElement>
                
                <!-- 升级按钮 -->
                <ui:Button name="UpgradeButton" text="升级" style="font-size: 40px;"/>
            </ui:VisualElement>
        </ui:VisualElement>
    </ui:VisualElement>
</ui:UXML>
```

### 坐骑列表项模板 - HorseItemTemplate.uxml
```xml
<!-- 文件：Assets/Scripts/Player/PlayerItems/PlayerHorse/UpgradePage/HorseItemTemplate.uxml -->
<ui:UXML>
    <ui:VisualElement name="HorseItem" class="horse-item" style="height: 240px;">
        <!-- 坐骑图标 -->
        <ui:VisualElement name="ItemIcon" style="width: 180px; height: 180px;"/>
        
        <!-- 坐骑信息 -->
        <ui:VisualElement style="flex-grow: 1;">
            <ui:Label name="ItemName" text="坐骑名称" style="font-size: 48px;"/>
            <ui:Label name="ItemLevel" text="Lv.1" style="font-size: 36px;"/>
            <ui:Label name="EquippedStatus" text="已装备" style="font-size: 28px;"/>
        </ui:VisualElement>
        
        <!-- 阶级指示器 -->
        <ui:VisualElement name="TierIndicator" style="width: 8px;"/>
    </ui:VisualElement>
</ui:UXML>
```

### HorseUpgradePage控制器
```csharp
// 文件：Assets/Scripts/Player/PlayerItems/PlayerHorse/UpgradePage/HorseUpgradePage.cs
[RequireComponent(typeof(UIDocument))]
public class HorseUpgradePage : MonoBehaviour
{
    [Header("UI Templates")]
    [SerializeField] private VisualTreeAsset horseItemTemplate;
    
    // 排序类型
    private enum SortType
    {
        Tier,      // 阶级 (S/A/B)
        Level,     // 等级
        Attack,    // 攻击力
        Defense,   // 防御力
        Command,   // 智力
        Total      // 总属性
    }
    
    void OnEnable()
    {
        // 初始化UI
        document = GetComponent<UIDocument>();
        root = document.rootVisualElement;
        InitializeUI();
        LoadHorseData();
        SubscribeToEvents();
    }
    
    // 加载坐骑数据
    void LoadHorseData()
    {
        allHorses = PlayerHorseBank.I.All
            .Where(h => h != null && h.unlocked && !string.IsNullOrEmpty(h.staticId))
            .ToList();
        
        LoadPlayerMaterials();
        displayedHorses = new List<PlayerHorse>(allHorses);
        SortHorses();
        PopulateHorseList(displayedHorses);
    }
    
    // 创建坐骑列表项
    VisualElement CreateHorseItem(PlayerHorse horse)
    {
        var element = horseItemTemplate.CloneTree();
        var horseStatic = horse.Static;
        
        // 设置图标
        var icon = element.Q<VisualElement>("ItemIcon");
        if (icon != null && horseStatic.iconSprite != null)
            icon.style.backgroundImage = new StyleBackground(horseStatic.iconSprite);
        
        // 设置名称（根据阶级设置颜色）
        var nameLabel = element.Q<Label>("ItemName");
        nameLabel.text = horseStatic.name;
        nameLabel.style.color = GetTierColor(horseStatic.tier);
        
        // 设置等级
        var levelLabel = element.Q<Label>("ItemLevel");
        levelLabel.text = $"Lv.{horse.level}";
        
        // 设置装备状态
        if (!string.IsNullOrEmpty(horse.equippedById))
        {
            var equippedLabel = element.Q<Label>("EquippedStatus");
            equippedLabel.style.display = DisplayStyle.Flex;
        }
        
        return element;
    }
    
    // 更新详情面板
    void UpdateDetailPanel()
    {
        // 显示当前属性（转换为百分比）
        var (currentAtk, currentDef, currentInt) = horseStatic.CalcStats(selectedHorse.level);
        horseStatsLabel.text = $"当前属性\n" +
                              $"攻击加成: {currentAtk * 100:F1}%\n" +
                              $"防御加成: {currentDef * 100:F1}%\n" +
                              $"智力加成: {currentInt * 100:F1}%";
        
        // 检查是否满级
        if (selectedHorse.level >= 50)
        {
            nextLevelStatsLabel.text = "已达到最高等级";
            upgradeButton.SetEnabled(false);
            upgradeButton.text = "已满级";
            return;
        }
        
        // 显示升级后属性
        var (nextAtk, nextDef, nextInt) = horseStatic.CalcStats(selectedHorse.level + 1);
        nextLevelStatsLabel.text = $"升级后\n" +
                                  $"攻击: {nextAtk * 100:F1}%\n" +
                                  $"防御: {nextDef * 100:F1}%\n" +
                                  $"智力: {nextInt * 100:F1}%";
        
        // 显示升级消耗
        int forageCost = horseStatic.CalcUpgradeCost(selectedHorse.level);
        UpdateMaterialsDisplay(forageCost);
    }
}
```

## API接口

### 坐骑升级接口
**路径**: `inventory/upgrade_gear`  
**方法**: POST

#### 请求
```csharp
// 文件：Assets/Scripts/Player/PlayerItems/PlayerHorse/UpgradePage/HorseUpgradePage.cs
[Serializable]
public class UpgradeGearRequest
{
    public string gear_uuid;  // 坐骑UUID
    
    public UpgradeGearRequest(string gearUuid)
    {
        gear_uuid = gearUuid;
    }
}
```

#### 响应
```csharp
// 文件：Assets/Scripts/Player/PlayerItems/PlayerHorse/UpgradePage/HorseUpgradePage.cs
[Serializable]
class UpgradeResponse
{
    public GearInfo gear_info;
    public Dictionary<string, long> current_balance;  // 更新后的材料余额
}

[Serializable]
class GearInfo
{
    public string gear_uuid;    // 坐骑UUID
    public int gear_level;      // 新等级
    public string on_card;       // 装备在哪个英雄上
}
```

### 获取坐骑数据接口
**路径**: `inventory/get_gear`  
**方法**: POST

#### 响应
```csharp
// 文件：Assets/Scripts/Network/Core/Service/GearService.cs
[Serializable]
private class GetGearResp
{
    public List<GearItem> gear;
}

[Serializable]
private class GearItem
{
    public string gear_uuid;    // 坐骑UUID
    public string gear_id;       // 坐骑静态ID (如: horse_1)
    public int gear_level;       // 当前等级
    public string on_card;       // 装备在哪个英雄上 (null表示未装备)
}
```

## 数据同步服务

### GearService - 装备数据同步
```csharp
// 文件：Assets/Scripts/Network/Core/Service/GearService.cs
public class GearService : MonoBehaviour
{
    public static GearService I { get; private set; }
    public bool IsInited { get; private set; }
    public event Action OnGearDataReady;
    
    public void Init()
    {
        // 发送获取装备请求
        MessageHub.I.Request("inventory/get_gear", new { }, OnGetGearResp, 10f);
    }
    
    void ProcessGearData(List<GearItem> gearList)
    {
        // 清空现有数据
        PlayerHorseBank.I?.Clear();
        
        // 分类处理装备
        foreach (var item in gearList)
        {
            if (item.gear_id.StartsWith("horse"))
            {
                // 添加到坐骑库
                var horse = PlayerHorseBank.I.AddWithUuid(
                    item.gear_uuid, 
                    item.gear_id, 
                    item.gear_level
                );
                if (!string.IsNullOrEmpty(item.on_card))
                {
                    horse.equippedById = item.on_card;
                }
            }
        }
        
        IsInited = true;
        OnGearDataReady?.Invoke();
    }
}
```

### 材料获取与存储
```csharp
// 文件：Assets/Scripts/Player/PlayerItems/PlayerHorse/UpgradePage/HorseUpgradePage.cs
void LoadPlayerMaterials()
{
    playerMaterials.Clear();
    
    // 从InventoryService获取马粮数量
    if (InventoryService.I != null)
    {
        long count = InventoryService.I.GetItemCount("Forage");
        playerMaterials["Forage"] = count;
    }
}
```

## 错误处理
```csharp
// 文件：Assets/Scripts/Player/PlayerItems/PlayerHorse/UpgradePage/HorseUpgradePage.cs
void OnUpgradeResponse(MessageHub.Response response)
{
    if (response == null || response.code != 0)
    {
        string errorMsg = response?.msg ?? "网络错误";
        Debug.LogError($"[HorseUpgradePage] Upgrade failed: {errorMsg}");
        
        // 重新启用按钮
        upgradeButton.SetEnabled(true);
        upgradeButton.text = "升级";
        return;
    }
    
    // 处理成功响应...
}
```

## 注意事项

1. **等级限制**：坐骑最高等级为50级
2. **装备限制**：
   - 每个英雄只能装备一匹坐骑
   - 每匹坐骑只能被一个英雄装备
   - 需要英雄封赏等级达到3级才能解锁坐骑槽位
3. **属性计算**：属性值在UI显示时需要乘以100转换为百分比
4. **数据同步**：坐骑数据通过GearService从服务器同步，不使用本地存档
5. **UI要求**：
   - 使用ScrollViewPro处理滚动列表
   - 字体大小至少25px以上
   - 根据坐骑阶级显示不同颜色（S级金色、A级紫色、B级蓝色）