# 装备系统文档

## 功能概述
装备系统管理玩家的武器和防具，支持装备升级、穿戴、卸下等功能。装备通过UUID唯一标识，可以装备到不同的武将卡牌上。系统包含装备升级、装备选择、装备管理等多个模块。

## 系统架构

### 核心组件
- **GearService** - 装备网络服务，处理与服务器的装备数据同步
- **PlayerGearBank** - 玩家装备背包，管理所有装备实例
- **GearDatabaseStatic** - 装备静态数据库，定义装备属性和升级公式
- **EquipmentManager** - 装备管理器，处理装备穿戴逻辑
- **GearUpgradePage** - 装备升级界面
- **GearSelectionPanel** - 装备选择面板

### 装备类型
```csharp
// 文件：Assets/Scripts/Game/Core/EquipSystem.cs
public enum EquipSlotType 
{ 
    Weapon,  // 武器槽
    Armor,   // 防具槽
    Mount    // 坐骑槽（预留）
}

public enum GearKind
{
    Weapon = 0,  // 武器
    Armor = 1    // 防具
}
```

## 数据结构

### 装备实例数据
```csharp
// 文件：Assets/Scripts/Player/PlayerItems/PlayerGear/PlayerGear.cs
[Serializable]
public class PlayerGear
{
    public string uuid;           // 唯一标识符
    public string staticId;       // 静态表ID (如 "weapon_1")
    public int level = 1;         // 强化等级 (1-30)
    public bool unlocked = true;  // 是否已解锁
    public string equippedById;   // 装备在哪个卡牌上
    
    // 获取静态数据
    public GearStatic Static => GearDatabaseStatic.Instance?.Get(staticId);
    
    // 确保UUID存在
    public void EnsureUuid()
    {
        if (string.IsNullOrEmpty(uuid))
            uuid = System.Guid.NewGuid().ToString();
    }
}
```

### 装备静态数据
```csharp
// 文件：Assets/Scripts/Player/PlayerItems/PlayerGear/GearDatabaseStatic.cs
[Serializable]
public class GearStatic
{
    public string id;              // 装备ID
    public string name;            // 装备名称
    public GearKind kind;          // 类型（武器/防具）
    public Tier tier;              // 品质等级（B/A/S）
    public float[] valueMultiplier;// 属性加成系数 [攻击系数, 防御系数]
    public Sprite iconSprite;      // 装备图标
    
    // 计算属性值
    public (float atk, float def) CalcStats(int level)
    {
        var coe = GetValueCoe(tier);
        var pow = GetValuePow(tier);
        float baseValue = coe * Mathf.Pow(level, pow);
        
        float atk = baseValue * valueMultiplier[0];
        float def = baseValue * valueMultiplier[1];
        
        return (atk, def);
    }
    
    // 计算升级材料消耗
    public (int iron, int wood, int steel) CalcUpgradeCost(int currentLevel)
    {
        int nextLevel = currentLevel + 1;
        
        // 基础材料：炼铁
        var ironCoe = GetIronCostCoe(tier);
        var ironPow = GetIronCostPow(tier);
        int iron = Mathf.CeilToInt(ironCoe * Mathf.Pow(nextLevel, ironPow));
        
        // 10级后需要精木
        int wood = 0;
        if (nextLevel > 10)
        {
            var woodCoe = GetFineWoodCoe(tier);
            var woodPow = GetFineWoodPow(tier);
            wood = Mathf.CeilToInt(woodCoe * Mathf.Pow(nextLevel - 10, woodPow));
        }
        
        // 20级后需要精钢
        int steel = 0;
        if (nextLevel > 20)
        {
            var steelCoe = GetSteelCoe(tier);
            var steelPow = GetSteelPow(tier);
            steel = Mathf.CeilToInt(steelCoe * Mathf.Pow(nextLevel - 20, steelPow));
        }
        
        return (iron, wood, steel);
    }
}
```

## 功能实现

### 1. 装备服务初始化
```csharp
// 文件：Assets/Scripts/Network/Core/Service/GearService.cs
public void Init()
{
    if (IsInited) return;
    
    Debug.Log("[GearService] Initializing...");
    
    // 确保依赖的 Bank 存在
    if (PlayerGearBank.I == null)
    {
        Debug.LogError("[GearService] PlayerGearBank.I is null!");
        return;
    }
    
    if (PlayerHorseBank.I == null)
    {
        Debug.LogError("[GearService] PlayerHorseBank.I is null!");
        return;
    }
    
    // 从服务器拉取装备数据
    RequestGearData();
}

void RequestGearData()
{
    MessageHub.I.Request("inventory/get_gear", new {}, OnGearDataReceived, 10f);
}

void ProcessGearData(List<GearItem> gearList)
{
    // 清空现有数据（全量更新）
    PlayerGearBank.I?.Clear();
    PlayerHorseBank.I?.Clear();

    // 临时存储分类后的数据
    var gearItems = new List<(string uuid, string id, int level, string equipped)>();
    var horseItems = new List<(string uuid, string id, int level, string equipped)>();

    // 分类
    foreach (var item in gearList)
    {
        if (item.gear_id.StartsWith("horse"))
        {
            horseItems.Add((item.gear_uuid, item.gear_id, item.gear_level, item.on_card));
        }
        else if (item.gear_id.StartsWith("weapon") || item.gear_id.StartsWith("armor"))
        {
            gearItems.Add((item.gear_uuid, item.gear_id, item.gear_level, item.on_card));
        }
    }

    // 批量添加到对应的 Bank
    UpdateGearBank(gearItems);
    UpdateHorseBank(horseItems);
    
    Debug.Log($"[GearService] Updated {gearItems.Count} gears, {horseItems.Count} horses");
}
```

### 2. 装备穿戴管理
```csharp
// 文件：Assets/Scripts/Player/PlayerItems/PlayerGear/EquipmentManager.cs
public static void Equip(
    PlayerCard    hero,
    PlayerGear    gear,
    EquipSlotType slot,
    PlayerCardBank cardBank,
    PlayerGearBank gearBank)
{
    if (hero == null || gear == null) return;

    /* 1) 这件装备原本在别人身上 → 先卸下 */
    if (!string.IsNullOrEmpty(gear.equippedById) &&
        gear.equippedById != hero.id)
    {
        var oldHero = cardBank.Get(gear.equippedById);
        if (oldHero != null)
            ClearSlot(oldHero, slot, gearBank);
    }

    /* 2) 如果该槽已有旧装备 → 卸下 */
    ClearSlot(hero, slot, gearBank);

    /* 3) 穿上新装备 */
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

    /* 4) 标记脏并存档 */
    gearBank.MarkDirty(gear.uuid);

    /* 5) 通知 UI */
    PlayerCardBankMgr.I?.RaiseCardUpdated(hero.id);
}

public static void ClearSlot(
    PlayerCard      hero,
    EquipSlotType   slot,
    PlayerGearBank  gearBank = null)
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
```

### 3. 装备升级界面
```csharp
// 文件：Assets/Scripts/Player/PlayerItems/PlayerGear/UpgradePage/GearUpgradePage.cs
void UpdateDetailPanel()
{
    if (selectedGear == null)
    {
        // 未选中装备时显示提示
        if (gearNameLabel != null) 
        {
            gearNameLabel.text = "请选择一件装备";
            gearNameLabel.style.fontSize = 24;
            gearNameLabel.style.color = new Color(0.7f, 0.7f, 0.7f);
        }
        return;
    }
    
    var gearStatic = selectedGear.Static;
    
    // 基础信息
    gearNameLabel.text = gearStatic.name;
    gearLevelLabel.text = $"等级 {selectedGear.level} / 30";
    
    // 图标
    if (gearStatic.iconSprite != null)
    {
        gearIcon.style.backgroundImage = new StyleBackground(gearStatic.iconSprite);
    }
    
    // 当前属性
    var (currentAtk, currentDef) = gearStatic.CalcStats(selectedGear.level);
    if (gearStatic.kind == GearKind.Weapon)
        gearStatsLabel.text = $"攻击力: {currentAtk:F0}";
    else
        gearStatsLabel.text = $"防御力: {currentDef:F0}";
    
    // 检查是否满级
    if (selectedGear.level >= 30)
    {
        nextLevelStatsLabel.text = "已达到最高等级";
        materialPanel.style.display = DisplayStyle.None;
        upgradeButton.SetEnabled(false);
        upgradeButton.text = "已满级";
        return;
    }
    
    // 下一级属性
    var (nextAtk, nextDef) = gearStatic.CalcStats(selectedGear.level + 1);
    if (gearStatic.kind == GearKind.Weapon)
    {
        var atkIncrease = nextAtk - currentAtk;
        nextLevelStatsLabel.text = $"下一级: {nextAtk:F0} (+{atkIncrease:F0})";
    }
    else
    {
        var defIncrease = nextDef - currentDef;
        nextLevelStatsLabel.text = $"下一级: {nextDef:F0} (+{defIncrease:F0})";
    }
    
    // 升级材料
    materialPanel.style.display = DisplayStyle.Flex;
    var (ironCost, woodCost, steelCost) = gearStatic.CalcUpgradeCost(selectedGear.level);
    
    UpdateMaterialsDisplay(ironCost, woodCost, steelCost);
    
    // 检查是否可升级
    bool canUpgrade = CheckCanUpgrade(ironCost, woodCost, steelCost);
    upgradeButton.SetEnabled(canUpgrade);
    upgradeButton.text = canUpgrade ? "升级" : "材料不足";
}
```

### 4. 装备升级请求
```csharp
// 文件：Assets/Scripts/Player/PlayerItems/PlayerGear/UpgradePage/GearUpgradePage.cs
void SendUpgradeRequest()
{
    if (selectedGear == null) return;
    
    if (string.IsNullOrEmpty(selectedGear.uuid))
    {
        Debug.LogError("[GearUpgradePage] Selected gear UUID is null or empty!");
        return;
    }
    
    var requestData = new UpgradeGearRequest(selectedGear.uuid);
    
    MessageHub.I.Request("inventory/upgrade_gear", requestData, OnUpgradeResponse, 10f);
    
    // 升级过程中禁用按钮
    upgradeButton.SetEnabled(false);
    upgradeButton.text = "升级中...";
}

void OnUpgradeResponse(MessageHub.Response response)
{
    if (response == null || response.code != 0)
    {
        string errorMsg = response?.msg ?? "网络错误";
        Debug.LogError($"[GearUpgradePage] Upgrade failed: {errorMsg}");
        
        // 重新启用按钮
        upgradeButton.SetEnabled(true);
        upgradeButton.text = "升级";
        return;
    }
    
    // 解析响应
    try
    {
        var data = JsonUtility.FromJson<UpgradeResponse>(response.dataJson);
        if (data?.gear_info != null)
        {
            // 更新本地装备数据
            selectedGear.level = data.gear_info.gear_level;
            
            // 刷新UI
            UpdateDetailPanel();
            RefreshGearListItem(selectedGear);
            
            Debug.Log($"[GearUpgradePage] {selectedGear.Static.name} 已升级到 Lv.{selectedGear.level}");
        }
    }
    catch (Exception e)
    {
        Debug.LogError($"[GearUpgradePage] Failed to parse upgrade response: {e}");
    }
}
```

### 5. 卸载装备功能
```csharp
// 文件：Assets/Scripts/UI/CardInventory/CardInventoryRebuild/CardDetailsController.cs
private void AttemptUnequip(EquipSlotType slot)
{
    if (currentDynamic == null)
    {
        PopupManager.Show("提示", "尚未拥有该武将");
        return;
    }

    string uuid = slot switch
    {
        EquipSlotType.Weapon => currentDynamic.equip.weaponUuid,
        EquipSlotType.Armor => currentDynamic.equip.armorUuid,
        EquipSlotType.Mount => currentDynamic.equip.accessoryUuid,
        _ => ""
    };

    if (string.IsNullOrEmpty(uuid))
    {
        PopupManager.Show("提示", "当前槽位没有装备");
        return;
    }

    // 发送卸载请求 - 注意这里的特殊格式
    var requestData = new ChangeGearRequest
    {
        gear_uuid = uuid,
        card_id = "",     // 空字符串表示卸载
        unload = 1        // 1 表示卸载操作
    };

    Debug.Log($"[CardDetailsController] Unequipping gear {uuid} from card {currentDynamic.id}");

    MessageHub.I.Request("card/change_gear", requestData, resp =>
    {
        if (resp == null || resp.code != 0)
        {
            Debug.LogError($"[CardDetailsController] Unequip failed: {resp?.msg ?? "network error"}");
            PopupManager.Show("错误", $"卸下装备失败: {resp?.msg ?? "网络错误"}");
            return;
        }

        // 更新本地数据
        UpdateLocalUnequipData(slot, uuid);
        PopupManager.Show("成功", "装备已卸下", 1.5f);
    }, 10f);
}
```

### 6. 装备选择面板
```csharp
// 文件：Assets/Scripts/UI/CardInventory/OldScript/GearSelectionPanel.cs
public void Open(PlayerCard card, EquipSlotType slot)
{
    if (card == null) return;
    
    currentCard = card;
    currentSlot = slot;
    
    // 获取当前装备的UUID
    selectedGearUuid = slot == EquipSlotType.Weapon 
        ? card.equip.weaponUuid 
        : card.equip.armorUuid;
    
    gameObject.SetActive(true);
    RefreshGears();
}

void RefreshGears()
{
    // 清空现有列表
    optionContainer.Clear();
    entries.Clear();
    
    // 获取所有符合类型的装备
    var kind = currentSlot == EquipSlotType.Weapon ? GearKind.Weapon : GearKind.Armor;
    var gears = PlayerGearBank.I.All
        .Where(g => g != null && g.Static != null && g.Static.kind == kind)
        .OrderBy(g => GetSortValue(g))
        .ToList();
    
    // 为每个装备创建条目
    foreach (var gear in gears)
    {
        var item = CreateGearItem(gear);
        optionContainer.Add(item);
        entries.Add(item);
    }
}

void OnGearClicked(PlayerGear gear)
{
    if (gear == null) return;
    
    selectedGearUuid = gear.uuid;
    
    // 更新选中状态
    UpdateSelectionVisual();
    
    // 显示装备按钮
    if (lastShownEquipBtn != null)
        lastShownEquipBtn.style.display = DisplayStyle.Flex;
}

void OnEquipClicked()
{
    if (string.IsNullOrEmpty(selectedGearUuid)) return;
    
    // 发送装备请求
    var request = new ChangeGearRequest
    {
        gear_uuid = selectedGearUuid,
        card_id = currentCard.id,
        unload = 0
    };
    
    MessageHub.I.Request("card/change_gear", request, OnEquipResponse, 10f);
}
```

## UI界面实现

### 1. 装备升级页面UI
```csharp
// 文件：Assets/Scripts/Player/PlayerItems/PlayerGear/UpgradePage/GearUpgradePage.cs
public class GearUpgradePage : MonoBehaviour
{
    [Header("UI Templates")]
    [SerializeField] private VisualTreeAsset gearItemTemplate;
    
    // UI References
    private UIDocument document;
    private VisualElement root;
    private ScrollViewPro gearListView;
    private VisualElement detailPanel;
    
    // 装备列表显示
    void PopulateGearList(List<PlayerGear> gears)
    {
        if (gearListView == null) return;
        
        // 清空内容容器
        gearListView.Clear();
        
        foreach (var gear in gears)
        {
            if (gearItemTemplate == null) continue;
            
            var element = CreateGearListItem(gear);
            gearListView.Add(element);
        }
    }
    
    VisualElement CreateGearListItem(PlayerGear gear)
    {
        var element = gearItemTemplate.CloneTree();
        var gearStatic = gear.Static;
        
        // 设置图标
        var iconElement = element.Q<VisualElement>("ItemIcon");
        if (iconElement != null && gearStatic.iconSprite != null)
        {
            iconElement.style.backgroundImage = new StyleBackground(gearStatic.iconSprite);
        }
        
        // 设置名称和等级
        var nameLabel = element.Q<Label>("ItemName");
        if (nameLabel != null)
        {
            nameLabel.text = gearStatic.name;
            nameLabel.style.color = GetTierColor(gearStatic.tier);
        }
        
        var levelLabel = element.Q<Label>("ItemLevel");
        if (levelLabel != null)
        {
            levelLabel.text = $"Lv.{gear.level}";
        }
        
        // 设置装备状态
        if (!string.IsNullOrEmpty(gear.equippedById))
        {
            var equippedLabel = element.Q<Label>("EquippedStatus");
            if (equippedLabel != null)
            {
                var card = PlayerCardBank.I?.Get(gear.equippedById);
                if (card != null)
                {
                    var cardStatic = CardDatabaseStatic.Instance?.GetCard(card.id);
                    equippedLabel.text = cardStatic != null ? $"装备于: {cardStatic.displayName}" : "已装备";
                }
                else
                {
                    equippedLabel.text = "已装备";
                }
                equippedLabel.style.display = DisplayStyle.Flex;
            }
        }
        
        // 点击事件
        element.RegisterCallback<ClickEvent>(evt => OnGearSelected(gear, element));
        element.userData = gear;
        
        return element;
    }
}
```

### 2. 装备选择面板UI
```csharp
// 文件：Assets/Scripts/UI/CardInventory/OldScript/GearSelectionPanel.cs
public class GearSelectionPanel : MonoBehaviour
{
    [Header("模板 & 数据源")]
    [SerializeField] private VisualTreeAsset gearItemTpl;     // 单条装备模板
    [SerializeField] private PlayerGearBank playerGearBank;   // 玩家背包
    [SerializeField] private GearDatabaseStatic gearDB;       // 装备数据库
    
    [Header("网格布局")]
    [SerializeField] private int itemsPerRow = 2;   // 每行装备数
    [SerializeField] private float gearSize = 240;  // 单张宽高
    [SerializeField] private float colGap = 8f;     // 列间距
    [SerializeField] private float rowGap = 12f;    // 行间距
    
    // 创建装备条目
    void CreateGearItem(PlayerGear pg, int index, int totalCount)
    {
        var ve = gearItemTpl.CloneTree();
        var st = pg.Static;
        
        // 设置基本信息
        ve.Q<Label>("Name").text = st.name;
        ve.Q<Label>("Type").text = st.kind == GearKind.Weapon ? "武器" : "防具";
        ve.Q<Label>("Level").text = $"Lv.{pg.level}";
        
        // 设置图标
        var icon = ve.Q<VisualElement>("Icon");
        if (icon != null && st.iconSprite != null)
        {
            icon.style.backgroundImage = new StyleBackground(st.iconSprite);
        }
        
        // 计算属性显示
        var (atk, def) = st.CalcStats(pg.level);
        ve.Q<Label>("Stat").text = st.kind == GearKind.Weapon 
            ? $"攻击: {atk:F0}" 
            : $"防御: {def:F0}";
        
        // 检查是否已装备
        bool isEquipped = pg.uuid == selectedGearUuid;
        bool equippedByOther = !string.IsNullOrEmpty(pg.equippedById) && pg.equippedById != currentCard.id;
        
        // 设置高亮效果
        if (isEquipped)
        {
            ve.AddToClassList("selected");
            ve.Q<Label>("EquippedTag").style.display = DisplayStyle.Flex;
        }
        
        // 如果被其他人装备，添加遮罩
        var mask = ve.Q<VisualElement>("DimMask");
        if (mask != null)
        {
            mask.style.display = equippedByOther ? DisplayStyle.Flex : DisplayStyle.None;
            if (equippedByOther)
            {
                mask.style.backgroundColor = new Color(0, 0, 0, 0.3f);
                mask.pickingMode = PickingMode.Ignore;
            }
        }
        
        // 获取按钮
        var optionBtn = ve.Q<Button>("GearOption");
        var equipBtn = ve.Q<Button>("EquipBtn");
        
        // 默认隐藏装备按钮
        if (equipBtn != null)
        {
            equipBtn.style.display = DisplayStyle.None;
        }
        
        // 点击选项按钮的处理
        if (optionBtn != null)
        {
            ve.Bounce(0.9f, 0.08f); // 弹跳动画效果
            
            optionBtn.RegisterCallback<ClickEvent>(_ =>
            {
                OnGearOptionClicked(ve, equipBtn, pg);
            });
        }
        
        // 装备按钮点击处理
        if (equipBtn != null)
        {
            equipBtn.clicked += () =>
            {
                selectedGearUuid = pg.uuid;
                OnEquipClicked();
            };
        }
        
        optionContainer.Add(ve);
    }
}
```

### 3. 装备槽UI（卡片详情页）
```csharp
// 文件：Assets/Scripts/UI/CardInventory/CardInventoryRebuild/CardEquipmentManager.cs
public class CardEquipmentManager : MonoBehaviour
{
    /// <summary>
    /// 刷新装备显示
    /// </summary>
    public void RefreshEquipmentSlots()
    {
        if (equipmentPanel == null || currentDynamic == null) return;

        // 获取装备数据
        var weaponData = GetEquipmentData(currentDynamic.equip.weaponUuid, EquipSlotType.Weapon);
        var armorData = GetEquipmentData(currentDynamic.equip.armorUuid, EquipSlotType.Armor);
        var mountData = GetEquipmentData(currentDynamic.equip.accessoryUuid, EquipSlotType.Mount);

        // 更新三个装备槽的显示
        UpdateEquipSlotVisual(0, weaponData, IsSlotUnlocked(EquipSlotType.Weapon));
        UpdateEquipSlotVisual(1, armorData, IsSlotUnlocked(EquipSlotType.Armor));
        UpdateEquipSlotVisual(2, mountData, IsSlotUnlocked(EquipSlotType.Mount));
    }
    
    /// <summary>
    /// 装备槽点击事件
    /// </summary>
    private void OnEquipSlotClicked(EquipSlotType slot, Button slotButton)
    {
        if (!IsSlotUnlocked(slot))
        {
            manager.ShowTooltip("装备槽未解锁");
            return;
        }

        string currentEquipId = GetCurrentEquipId(slot);
        
        if (string.IsNullOrEmpty(currentEquipId))
        {
            // 没有装备，打开选择面板
            OpenEquipmentPanel(slot);
        }
        else
        {
            // 有装备，显示操作弹窗
            ShowEquipmentPopup(slot, slotButton);
        }
    }
    
    /// <summary>
    /// 显示装备操作弹窗
    /// </summary>
    private void ShowEquipmentPopup(EquipSlotType slot, Button slotButton)
    {
        CleanupEquipmentPopup();

        // 创建弹窗
        equipPopup = new VisualElement();
        equipPopup.AddToClassList("equipment-popup");
        
        // 更换按钮
        var changeBtn = new Button(() =>
        {
            CleanupEquipmentPopup();
            OpenEquipmentPanel(slot);
        });
        changeBtn.text = "更换";
        changeBtn.AddToClassList("popup-button");
        equipPopup.Add(changeBtn);

        // 卸下按钮
        var unequipBtn = new Button(() =>
        {
            CleanupEquipmentPopup();
            string uuid = GetCurrentEquipId(slot);
            UnequipGear(slot, uuid);
        });
        unequipBtn.text = "卸下";
        unequipBtn.AddToClassList("popup-button");
        equipPopup.Add(unequipBtn);

        // 添加到根元素
        root.Add(equipPopup);

        // 定位弹窗
        equipPopup.schedule.Execute(() =>
        {
            var buttonPos = slotButton.worldBound;
            var x = buttonPos.center.x;
            var y = buttonPos.yMax + 5;
            
            equipPopup.style.left = x - equipPopup.resolvedStyle.width / 2;
            equipPopup.style.top = y;
        }).ExecuteLater(1);

        // 点击其他地方关闭
        root.RegisterCallback<ClickEvent>(OnRootClick);
        popupHooked = true;
    }
}
```

### 4. 主公页面装备UI
```csharp
// 文件：Assets/Scripts/UI/PlayerCard/PlayerCardPage.cs
public class PlayerCardPage : MonoBehaviour
{
    // 装备槽UI元素
    private Button weaponSlot;
    private Button armorSlot;
    private Button mountSlot;
    
    // 卸载按钮
    private Button weaponRemoveBtn;
    private Button armorRemoveBtn;
    private Button mountRemoveBtn;
    
    /// <summary>
    /// 初始化装备槽
    /// </summary>
    void InitializeEquipmentSlots()
    {
        // 武器槽
        weaponSlot = root.Q<Button>("WeaponSlot");
        weaponRemoveBtn = root.Q<Button>("WeaponRemoveBtn");
        if (weaponSlot != null)
        {
            weaponSlot.clicked += () => OnEquipSlotClicked(EquipSlotType.Weapon);
        }
        if (weaponRemoveBtn != null)
        {
            weaponRemoveBtn.clicked += () => OnUnequipClicked(EquipSlotType.Weapon);
            weaponRemoveBtn.style.display = DisplayStyle.None; // 默认隐藏
        }
        
        // 护甲槽
        armorSlot = root.Q<Button>("ArmorSlot");
        armorRemoveBtn = root.Q<Button>("ArmorRemoveBtn");
        if (armorSlot != null)
        {
            armorSlot.clicked += () => OnEquipSlotClicked(EquipSlotType.Armor);
        }
        if (armorRemoveBtn != null)
        {
            armorRemoveBtn.clicked += () => OnUnequipClicked(EquipSlotType.Armor);
            armorRemoveBtn.style.display = DisplayStyle.None; // 默认隐藏
        }
        
        // 坐骑槽
        mountSlot = root.Q<Button>("MountSlot");
        mountRemoveBtn = root.Q<Button>("MountRemoveBtn");
        if (mountSlot != null)
        {
            mountSlot.clicked += () => OnEquipSlotClicked(EquipSlotType.Mount);
        }
        if (mountRemoveBtn != null)
        {
            mountRemoveBtn.clicked += () => OnUnequipClicked(EquipSlotType.Mount);
            mountRemoveBtn.style.display = DisplayStyle.None; // 默认隐藏
        }
    }
    
    /// <summary>
    /// 刷新装备槽显示
    /// </summary>
    void RefreshEquipSlotByUuid(Button slot, string uuid, string type, Button removeBtn)
    {
        if (slot == null) return;
        
        var iconElement = slot.Q<VisualElement>("Icon");
        var levelLabel = slot.Q<Label>("Level");
        
        if (!string.IsNullOrEmpty(uuid))
        {
            // 有装备
            var icon = GetEquipmentIcon(uuid, type);
            if (iconElement != null && icon != null)
            {
                iconElement.style.backgroundImage = new StyleBackground(icon);
            }
            
            // 显示等级
            int equipLevel = GetEquipmentLevel(uuid, type);
            levelLabel.text = $"Lv.{equipLevel}";
            levelLabel.style.display = DisplayStyle.Flex;
            
            // 显示卸载按钮
            if (removeBtn != null)
            {
                removeBtn.style.display = DisplayStyle.Flex;
            }
        }
        else
        {
            // 无装备
            if (iconElement != null)
            {
                iconElement.style.backgroundImage = null;
            }
            
            // 隐藏等级标签
            levelLabel.text = "";
            levelLabel.style.display = DisplayStyle.None;
            
            // 隐藏卸载按钮
            if (removeBtn != null)
            {
                removeBtn.style.display = DisplayStyle.None;
            }
        }
    }
}
```

## API接口

### 获取装备数据
**路径**: `inventory/get_gear`
**方法**: POST

#### 响应
```json
{
    "gear": [
        {
            "gear_uuid": "abc-123-def",
            "gear_id": "weapon_1",
            "gear_level": 10,
            "on_card": "hero_001"
        }
    ]
}
```

### 装备升级
**路径**: `inventory/upgrade_gear`
**方法**: POST

#### 请求
```json
{
    "gear_uuid": "abc-123-def"
}
```

#### 响应
```json
{
    "gear_info": {
        "gear_uuid": "abc-123-def",
        "gear_level": 11,
        "on_card": "hero_001"
    },
    "current_balance": {
        "RefinedIron": 850,
        "FineWood": 200,
        "FineSteel": 50
    }
}
```

### 卸载装备
**路径**: `card/change_gear`
**方法**: POST

#### 请求（卸载格式）
```json
{
    "gear_uuid": "abc-123-def",
    "card_id": "",    // 空字符串表示卸载
    "unload": 1       // 1表示卸载操作
}
```

#### 响应
```json
{
    "code": 0,
    "msg": "success"
}
```

注意：卸载装备使用的是同一个 `change_gear` 接口，但参数不同：
- `card_id` 设为空字符串
- `unload` 设为 1

## 错误处理

```csharp
// 文件：Assets/Scripts/UI/CardInventory/OldScript/GearSelectionPanel.cs
void OnEquipResponse(MessageHub.Response response)
{
    if (response == null || response.code != 0)
    {
        // 根据错误码提供更友好的提示
        string errorMsg = response.code switch
        {
            403 => "目标卡牌的封赏等级不足",
            404 => "装备不存在或不属于您",
            _ => response.msg ?? "装备更换失败"
        };
        
        PopupManager.Show("错误", errorMsg);
        return;
    }
    
    // 成功处理...
}
```

## 注意事项

1. **装备唯一性**
   - 每件装备通过UUID唯一标识
   - 同一件装备只能装备在一个卡牌上
   - 更换装备时会自动从原卡牌卸下

2. **升级限制**
   - 装备最高等级为30级
   - 不同等级需要不同材料
   - 1-10级：只需要炼铁
   - 11-20级：需要炼铁和精木
   - 21-30级：需要炼铁、精木和精钢

3. **装备槽解锁**
   - 武器槽和护甲槽需要达到一定条件才能解锁
   - 坐骑槽为预留功能，暂未开放

4. **数据同步**
   - 装备数据以服务器为准
   - 本地只做缓存和临时显示
   - 所有操作需等待服务器响应

5. **性能优化**
   - 装备列表使用虚拟滚动
   - 装备图标使用缓存机制
   - 批量更新减少网络请求

6. **装备品质**
   - S级装备：金色，最高品质
   - A级装备：紫色，高品质
   - B级装备：蓝色，普通品质

7. **属性计算**
   - 武器只加攻击力
   - 护甲只加防御力
   - 属性值通过公式计算：基础值 = 系数 × 等级^指数