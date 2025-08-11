# 背包系统文档

## 功能概述
背包系统管理玩家所有物品，包括普通道具、装备、坐骑、碎片、资源等。支持物品分类显示、排序、使用等功能。系统通过InventoryService与服务器同步数据，通过InventoryUIController管理界面显示。

## 系统架构

### 核心组件
- **InventoryService** - 背包网络服务，处理与服务器的数据同步
- **InventoryUIController** - 背包UI控制器，管理界面显示和交互
- **ItemDatabaseStatic** - 物品静态数据库
- **PlayerResourceBank** - 玩家资源管理
- **PlayerGearBank** - 装备背包管理
- **PlayerHorseBank** - 坐骑背包管理

### UI界面结构
背包界面采用网格布局，支持分类筛选、排序、物品详情显示等功能。

#### 界面布局
```
┌─────────────────────────────────────────┐
│  [返回]        背包系统        [排序]    │
├─────────────────────────────────────────┤
│ [全部][武器][防具][坐骑][碎片][材料][消耗]│
├─────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  │物品│ │物品│ │物品│ │物品│ │物品│   │
│  │格子│ │格子│ │格子│ │格子│ │格子│   │
│  └────┘ └────┘ └────┘ └────┘ └────┘   │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  │物品│ │物品│ │物品│ │物品│ │物品│   │
│  │格子│ │格子│ │格子│ │格子│ │格子│   │
│  └────┘ └────┘ └────┘ └────┘ └────┘   │
├─────────────────────────────────────────┤
│  [图标] 物品名称                        │
│         物品描述...                      │
│         数量: 999  等级: Lv.10          │
│         [使用] [详情]                    │
└─────────────────────────────────────────┘
```

## 数据结构

### 统一物品数据结构
```csharp
// 文件：Assets/Scripts/UI/PlayerInventory/InventoryUIController.cs
// 统一的物品数据结构，用于UI显示
private class UnifiedInventoryItem
{
    // 基础标识
    public string id;              // 物品ID
    public string uuid;            // 唯一ID（装备/马匹专用）
    public UnifiedItemType type;   // 物品类型
    
    // 显示信息
    public string name;            // 显示名称
    public string description;     // 描述
    public Sprite icon;            // 图标
    public string tierGrade;       // S/A/B 等级
    public int displayRarity;      // 显示稀有度（1-5）
    
    // 数量/等级
    public long count;             // 数量（普通物品）或1（装备/马匹）
    public int level;              // 强化等级（装备/马匹）
    
    // 装备状态
    public bool isEquipped;        // 是否已装备
    public string equippedOn;      // 装备在哪个角色上
    
    // 原始数据
    public object sourceData;      // 原始数据引用
    
    // 排序权重
    public int sortOrder;          // 用于排序
}
```

### 物品静态数据
```csharp
// 文件：Assets/Scripts/UI/PlayerInventory/ItemInventoryStatic.cs
[Serializable]
public class ItemStatic
{
    [Header("基础信息")]
    public string itemId;           // 对应服务器的 item_id
    public string itemName;         // 显示名称
    [TextArea(2, 4)]
    public string description;      // 物品描述
    
    [Header("显示")]
    public Sprite icon;             // 物品图标
    public ItemType itemType;       // 物品类型
    [Range(1, 5)]
    public int rarity = 1;          // 稀有度 1-5
    
    [Header("功能")]
    public bool isStackable = true; // 是否可堆叠（无限堆叠）
    public bool isUsable = false;   // 是否可使用
    
    [Header("额外信息")]
    public int sortOrder = 0;       // 排序优先级
    public string[] tags;           // 标签（用于搜索/筛选）
}
```

## 功能实现

### 1. 背包服务初始化
```csharp
// 文件：Assets/Scripts/Network/Core/Service/InventoryService.cs
public void Init(PlayerCardBank bankSO = null)
{
    cardBank = bankSO ?? PlayerCardBank.I;
    RequestFullSync();
    IsInited = true;
}

void RequestFullSync()
{
    MessageHub.I.Request(MethodGet, new { }, OnFullResp, 10f);
}

void OnFullResp(MessageHub.Response r)
{
    if (r == null || r.code != 0)
    {
        Debug.LogWarning($"[Inv] 拉背包失败 code={r?.code} msg={r?.msg}");
        return;
    }

    ApplyFull(r.dataJson);
    Debug.Log($"[Inv] 全量同步完成：资源 {bag.Count} 条，碎片 {shards.Count} 条");
}
```

### 2. UI初始化
```csharp
// 文件：Assets/Scripts/UI/PlayerInventory/InventoryUIController.cs
void OnEnable()
{
    InitializeUIElements();
    LoadDatabases();
    SetupEventHandlers();
    ConfigureScrollView();
    SubscribeToDataChanges();

    // 首次加载数据
    LoadAllInventoryData();
    GenerateItemSlots();
    
    // 默认选中"全部"分类
    SelectCategory(UnifiedItemType.All);
}

void InitializeUIElements()
{
    document = GetComponent<UIDocument>();
    if (document == null) return;

    var root = document.rootVisualElement;
    scrollView = root.Q<ScrollViewPro>("ItemScrollView");
    gridContainer = root.Q<VisualElement>("ItemGrid");

    // 分类按钮
    categoryButtons[UnifiedItemType.All] = root.Q<Button>("CategoryAll");
    categoryButtons[UnifiedItemType.Weapon] = root.Q<Button>("CategoryWeapon");
    categoryButtons[UnifiedItemType.Armor] = root.Q<Button>("CategoryArmor");
    categoryButtons[UnifiedItemType.Mount] = root.Q<Button>("CategoryMount");
    categoryButtons[UnifiedItemType.Shard] = root.Q<Button>("CategoryShard");
    categoryButtons[UnifiedItemType.Material] = root.Q<Button>("CategoryMaterial");
    categoryButtons[UnifiedItemType.Consumable] = root.Q<Button>("CategoryConsumable");

    // 底部详情
    selectedItemIcon = root.Q<VisualElement>("SelectedItemIcon");
    itemNameLabel = root.Q<Label>("ItemName");
    itemDescLabel = root.Q<Label>("ItemDescription");
    itemDetailStatLabel = root.Q<Label>("ItemDetailStat");
    itemCountLabel = root.Q<Label>("ItemCount");
    itemLevelLabel = root.Q<Label>("ItemLevel");
    useBtn = root.Q<Button>("UseBtn");
    infoBtn = root.Q<Button>("InfoBtn");

    // 排序按钮
    sortBtn = root.Q<Button>("SortBtn");
}
```

### 3. 加载物品数据
```csharp
// 文件：Assets/Scripts/UI/PlayerInventory/InventoryUIController.cs
void LoadAllInventoryData()
{
    allItems.Clear();

    // 1. 加载普通物品
    LoadNormalItems();

    // 2. 加载装备
    LoadGearItems();

    // 3. 加载马匹
    LoadHorseItems();
    
    // 4. 加载碎片
    LoadShardItems();

    // 5. 根据当前分类筛选
    FilterByCategory(currentCategory);

    // 6. 排序
    SortItems();

    Debug.Log($"[Inventory] Loaded total {allItems.Count} items");
}

void LoadNormalItems()
{
    if (InventoryService.I == null || itemDatabase == null) return;

    foreach (var kvp in InventoryService.I.Bag)
    {
        var itemData = itemDatabase.Get(kvp.Key);
        if (itemData == null) continue;

        var unifiedItem = new UnifiedInventoryItem
        {
            id = kvp.Key,
            uuid = null,
            type = ConvertItemType(itemData.itemType),
            name = itemData.itemName,
            description = itemData.description,
            icon = itemData.icon,
            tierGrade = "",  // 普通物品没有等级
            displayRarity = itemData.rarity,
            count = kvp.Value,
            level = 0,
            isEquipped = false,
            equippedOn = null,
            sourceData = itemData,
            sortOrder = itemData.sortOrder
        };

        allItems.Add(unifiedItem);
    }
}
```

### 4. 分类和排序
```csharp
// 文件：Assets/Scripts/UI/PlayerInventory/InventoryUIController.cs
void FilterByCategory(UnifiedItemType category)
{
    if (category == UnifiedItemType.All)
    {
        displayedItems = new List<UnifiedInventoryItem>(allItems);
    }
    else
    {
        displayedItems = allItems.Where(item => item.type == category).ToList();
    }
}

void SortItems()
{
    switch (currentSortMode)
    {
        case SortMode.Default:
            displayedItems.Sort((a, b) => a.sortOrder.CompareTo(b.sortOrder));
            break;
        case SortMode.Rarity:
            displayedItems.Sort((a, b) =>
            {
                int rarityCompare = b.displayRarity.CompareTo(a.displayRarity);
                if (rarityCompare != 0) return rarityCompare;
                return CompareTierGrade(a.tierGrade, b.tierGrade);
            });
            break;
        case SortMode.Count:
            displayedItems.Sort((a, b) => b.count.CompareTo(a.count));
            break;
        case SortMode.Level:
            displayedItems.Sort((a, b) => b.level.CompareTo(a.level));
            break;
        case SortMode.Type:
            displayedItems.Sort((a, b) =>
            {
                int typeCompare = a.type.CompareTo(b.type);
                if (typeCompare != 0) return typeCompare;
                return CompareTierGrade(a.tierGrade, b.tierGrade);
            });
            break;
    }
}
```

### 5. 资源同步
```csharp
// 文件：Assets/Scripts/Player/PlayerResource/PlayerResourcesBank.cs
void Start()
{
    // ① 先填本地默认值
    foreach (ResourceType rt in Enum.GetValues(typeof(ResourceType)))
        _store[rt] = GetDefaultFromSO(rt);

    // ② 如果 InventoryService 已经初始化 → 全量同步一次
    if (InventoryService.I != null && InventoryService.I.IsInited)
        SyncAllFromInventory();

    // ③ 订阅后续服务器更新
    if (InventoryService.I != null)
        InventoryService.I.OnItemChanged += HandleServerItem;
}

void HandleServerItem(string itemId, long newCnt)
{
    if (!Enum.TryParse(itemId, out ResourceType rt)) return;
    Set(rt, newCnt);
}
```

### 6. 装备管理
```csharp
// 文件：Assets/Scripts/Network/Core/Service/GearService.cs
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
        else
        {
            Debug.LogWarning($"[GearService] Unknown gear type: {item.gear_id}");
        }
    }

    // 批量添加到对应的 Bank
    UpdateGearBank(gearItems);
    UpdateHorseBank(horseItems);
    
    Debug.Log($"[GearService] Updated {gearItems.Count} gears, {horseItems.Count} horses");
}
```

## UI界面实现

### 1. UI控制器结构
```csharp
// 文件：Assets/Scripts/UI/PlayerInventory/InventoryUIController.cs
[RequireComponent(typeof(UIDocument))]
public class InventoryUIController : MonoBehaviour
{
    /*──────── 统一的物品类型 ────────*/
    public enum UnifiedItemType
    {
        All,        // 全部
        Weapon,     // 武器
        Armor,      // 防具
        Mount,      // 坐骑
        Shard,      // 碎片
        Material,   // 材料
        Consumable, // 消耗品
        Gift,       // 礼物
        Special,    // 特殊
        Currency    // 货币
    }

    /*──────── Inspector 配置 ────────*/
    [Header("UI 模板")]
    [SerializeField] private VisualTreeAsset itemSlotTemplate;

    [Header("数据库")]
    [SerializeField] private ItemDatabaseStatic itemDatabase;
    [SerializeField] private GearDatabaseStatic gearDatabase;
    [SerializeField] private HorseDatabaseStatic horseDatabase;
    [SerializeField] private CardDatabaseStatic cardDatabase;

    [Header("网格布局")]
    [SerializeField] private float slotSize = 240f;
    [SerializeField] private float slotSpacing = 68f;
    [SerializeField] private float containerPadding = 10f;
}
```

### 2. 物品格子生成
```csharp
// 文件：Assets/Scripts/UI/PlayerInventory/InventoryUIController.cs
void GenerateItemSlots()
{
    if (gridContainer == null || itemSlotTemplate == null) return;

    gridContainer.Clear();

    // 计算需要的行数
    int totalItems = displayedItems.Count;
    int rows = Mathf.CeilToInt((float)totalItems / itemsPerRow);

    // 为每个物品创建格子
    for (int i = 0; i < displayedItems.Count; i++)
    {
        var item = displayedItems[i];
        var slot = CreateItemSlot(item);
        gridContainer.Add(slot);
    }

    // 添加空格子填充
    int emptySlotsNeeded = (rows * itemsPerRow) - totalItems;
    for (int i = 0; i < emptySlotsNeeded; i++)
    {
        var emptySlot = CreateEmptySlot();
        gridContainer.Add(emptySlot);
    }

    // 设置网格布局
    UpdateGridLayout();
}

Button CreateItemSlot(UnifiedInventoryItem slotData)
{
    var slot = itemSlotTemplate.CloneTree().Q<Button>("ItemSlot");
    if (slot == null) return null;

    // 设置图标
    var iconElement = slot.Q<VisualElement>("ItemIcon");
    if (iconElement != null && slotData.icon != null)
    {
        iconElement.style.backgroundImage = new StyleBackground(slotData.icon);
    }

    // 设置数量标签
    var quantityLabel = slot.Q<Label>("QuantityLabel");
    if (quantityLabel != null)
    {
        if (slotData.count > 1)
        {
            quantityLabel.text = FormatQuantity(slotData.count);
            quantityLabel.style.display = DisplayStyle.Flex;
        }
        else
        {
            quantityLabel.style.display = DisplayStyle.None;
        }
    }

    // 设置稀有度光效
    var rarityGlow = slot.Q<VisualElement>("RarityGlow");
    if (rarityGlow != null)
    {
        rarityGlow.style.backgroundColor = GetRarityColor(slotData.displayRarity);
    }

    // 点击事件
    slot.clicked += () => OnSlotClicked(slot, slotData);
    slot.userData = slotData;

    return slot;
}
```

### 3. 选中效果和动画
```csharp
// 文件：Assets/Scripts/UI/PlayerInventory/InventoryUIController.cs
void OnSlotClicked(Button slot, UnifiedInventoryItem slotData)
{
    // 取消之前的选中
    if (currentSelectedSlot != null)
    {
        currentSelectedSlot.RemoveFromClassList("item-slot-selected");
        if (breathingCoroutine != null)
        {
            StopCoroutine(breathingCoroutine);
            breathingCoroutine = null;
        }

        currentSelectedSlot.style.borderTopColor = new Color(0.31f, 0.31f, 0.39f, 0.5f);
        currentSelectedSlot.style.borderRightColor = new Color(0.31f, 0.31f, 0.39f, 0.5f);
        currentSelectedSlot.style.borderBottomColor = new Color(0.31f, 0.31f, 0.39f, 0.5f);
        currentSelectedSlot.style.borderLeftColor = new Color(0.31f, 0.31f, 0.39f, 0.5f);

        var oldIcon = currentSelectedSlot.Q<VisualElement>("ItemIcon");
        if (oldIcon != null)
            oldIcon.style.scale = new Scale(Vector3.one);
    }

    // 设置新的选中
    currentSelectedSlot = slot;
    slot.AddToClassList("item-slot-selected");

    // 动画效果
    slot.style.scale = new Scale(new Vector3(1.02f, 1.02f, 1f));
    slot.schedule.Execute(() =>
    {
        slot.style.scale = new Scale(Vector3.one);
    }).ExecuteLater(150);

    var iconElement = slot.Q<VisualElement>("ItemIcon");
    if (iconElement != null)
        iconElement.style.scale = new Scale(new Vector3(1.05f, 1.05f, 1f));

    StartBreathingEffect(slot);
    UpdateItemDetails(slotData);

    // 记住选中
    categorySelectedItems[currentCategory] = slotData.id;
}

System.Collections.IEnumerator BreathingEffectCoroutine(Button slot)
{
    float time = 0;
    Color brightColor = new Color(1f, 1f, 1f, 0.95f);
    Color dimColor = new Color(1f, 1f, 1f, 0.7f);
    
    while (slot != null && slot == currentSelectedSlot)
    {
        time += Time.deltaTime;
        float t = (Mathf.Sin(time * 2f) + 1f) / 2f;
        Color currentColor = Color.Lerp(dimColor, brightColor, t);
        
        slot.style.borderTopColor = currentColor;
        slot.style.borderRightColor = currentColor;
        slot.style.borderBottomColor = currentColor;
        slot.style.borderLeftColor = currentColor;
        
        yield return null;
    }
}
```

### 4. 物品详情显示
```csharp
// 文件：Assets/Scripts/UI/PlayerInventory/InventoryUIController.cs
void UpdateItemDetails(UnifiedInventoryItem item)
{
    if (item == null)
    {
        ClearItemDetails();
        return;
    }

    // 更新图标
    if (selectedItemIcon != null && item.icon != null)
    {
        selectedItemIcon.style.backgroundImage = new StyleBackground(item.icon);
    }

    // 更新名称
    if (itemNameLabel != null)
    {
        itemNameLabel.text = item.name;
        if (!string.IsNullOrEmpty(item.tierGrade))
        {
            itemNameLabel.style.color = GetTierColor(item.tierGrade);
        }
        else
        {
            itemNameLabel.style.color = Color.white;
        }
    }

    // 更新描述
    if (itemDescLabel != null)
        itemDescLabel.text = item.description;

    // 更新数量/等级
    if (itemCountLabel != null)
    {
        if (item.count > 1)
        {
            itemCountLabel.text = $"数量: {item.count}";
            itemCountLabel.style.display = DisplayStyle.Flex;
        }
        else
        {
            itemCountLabel.style.display = DisplayStyle.None;
        }
    }

    if (itemLevelLabel != null)
    {
        if (item.level > 0)
        {
            itemLevelLabel.text = $"Lv.{item.level}";
            itemLevelLabel.style.display = DisplayStyle.Flex;
        }
        else
        {
            itemLevelLabel.style.display = DisplayStyle.None;
        }
    }

    // 更新属性详情（装备/坐骑专用）
    if (itemDetailStatLabel != null)
    {
        UpdateItemStats(item);
    }

    // 更新按钮状态
    UpdateActionButtons(item);
}
```

### 5. 自适应网格布局
```csharp
// 文件：Assets/Scripts/UI/PlayerInventory/InventoryUIController.cs
void UpdateGridLayout()
{
    if (gridContainer == null) return;

    // 设置flex方向和wrap
    gridContainer.style.flexDirection = FlexDirection.Row;
    gridContainer.style.flexWrap = Wrap.Wrap;
    gridContainer.style.justifyContent = Justify.FlexStart;
    gridContainer.style.alignItems = Align.FlexStart;

    // 设置间距
    gridContainer.style.paddingTop = containerPadding;
    gridContainer.style.paddingLeft = containerPadding;
    gridContainer.style.paddingRight = containerPadding;
    gridContainer.style.paddingBottom = containerPadding;

    // 更新每个格子的大小
    foreach (var child in gridContainer.Children())
    {
        if (child is Button slot)
        {
            slot.style.width = slotSize;
            slot.style.height = slotSize;
            slot.style.marginRight = slotSpacing;
            slot.style.marginBottom = slotSpacing;
        }
    }

    // 调整滚动视图
    AdjustScrollViewHeight();
}

int CalculateItemsPerRow()
{
    if (scrollView == null) return 1;

    float availableWidth = scrollView.resolvedStyle.width;
    if (float.IsNaN(availableWidth) || availableWidth <= 0)
    {
        availableWidth = 1920;
    }

    availableWidth -= containerPadding * 2;
    int itemsPerRow = Mathf.FloorToInt((availableWidth + slotSpacing) / (slotSize + slotSpacing));

    return Mathf.Max(1, itemsPerRow);
}

void OnGeometryChanged(GeometryChangedEvent evt)
{
    int newItemsPerRow = CalculateItemsPerRow();
    if (newItemsPerRow != itemsPerRow && newItemsPerRow > 0)
    {
        Debug.Log($"[Inventory] Window resized: {itemsPerRow} -> {newItemsPerRow}");
        itemsPerRow = newItemsPerRow;
        GenerateItemSlots();
    }
}
```

### 6. 数据更新监听
```csharp
// 文件：Assets/Scripts/UI/PlayerInventory/InventoryUIController.cs
void SubscribeToDataChanges()
{
    // 普通物品变化
    if (InventoryService.I != null)
    {
        InventoryService.I.OnItemChanged += OnInventoryItemChanged;
        InventoryService.I.OnShardChanged += OnShardChanged;
    }

    // 装备变化
    if (PlayerGearBank.I != null)
    {
        PlayerGearBank.I.onGearChanged += OnGearChanged;
        PlayerGearBank.I.onGearUpdated += OnGearUpdated;
    }

    // 马匹变化
    if (PlayerHorseBank.I != null)
    {
        PlayerHorseBank.I.onHorseChanged += OnHorseChanged;
        PlayerHorseBank.I.onHorseUpdated += OnHorseUpdated;
    }
}

void OnInventoryItemChanged(string itemId, long newCount)
{
    // 找到对应的物品
    var item = allItems.FirstOrDefault(i => i.id == itemId);
    if (item != null)
    {
        item.count = newCount;
        
        // 如果当前显示中包含这个物品，刷新显示
        if (displayedItems.Contains(item))
        {
            RefreshItemSlot(item);
        }
        
        // 如果是当前选中的物品，更新详情
        if (currentSelectedSlot?.userData == item)
        {
            UpdateItemDetails(item);
        }
    }
}
```

### 7. UI样式配置
```css
/* 文件：Assets/Scripts/UI/PlayerInventory/ItemSlotTemplate.uss */
.item-slot {
    width: 240px;
    height: 240px;
    margin: 10px;
    background-color: rgba(60, 60, 60, 0.8);
    border-width: 2px;
    border-color: rgba(79, 79, 100, 0.5);
    border-radius: 8px;
    transition-duration: 0.15s;
}

.item-slot:hover {
    border-color: rgba(100, 150, 200, 0.8);
    scale: 1.02;
}

.item-slot-selected {
    border-color: rgba(255, 200, 100, 1);
    background-color: rgba(80, 80, 80, 0.9);
}

.item-icon {
    width: 75%;
    height: 75%;
    align-self: center;
    -unity-background-scale-mode: scale-to-fit;
}

.label-quantity {
    position: absolute;
    bottom: 2%;
    right: 1%;
    font-size: 32px;
    color: rgb(56, 35, 23);
    -unity-font-style: bold;
}

.rarity-glow {
    position: absolute;
    bottom: 0;
    width: 100%;
    height: 7px;
    background-color: rgba(255, 255, 255, 0.3);
}
```

### 8. 性能优化

#### 虚拟滚动
```csharp
// 文件：Assets/Scripts/UI/PlayerInventory/InventoryUIController.cs
void ConfigureScrollView()
{
    if (scrollView == null) return;

    scrollView.mode = ScrollViewMode.Vertical;
    scrollView.verticalScrollerVisibility = ScrollerVisibility.Auto;
    scrollView.horizontalScrollerVisibility = ScrollerVisibility.Hidden;
    
    // 启用虚拟化以提升性能
    scrollView.virtualizationMethod = CollectionVirtualizationMethod.DynamicHeight;
    
    // 监听几何变化以自适应布局
    scrollView.RegisterCallback<GeometryChangedEvent>(OnGeometryChanged);
}
```

#### 图标缓存
```csharp
// 文件：Assets/Scripts/UI/PlayerInventory/InventoryUIController.cs
private Dictionary<string, Sprite> iconCache = new();

Sprite GetCachedIcon(string itemId)
{
    if (iconCache.TryGetValue(itemId, out var cached))
        return cached;
    
    // 根据类型加载图标
    Sprite icon = null;
    var itemData = itemDatabase?.Get(itemId);
    if (itemData != null)
    {
        icon = itemData.icon;
    }
    
    if (icon != null)
    {
        iconCache[itemId] = icon;
    }
    
    return icon;
}
```

### 9. 交互特效

#### 拖拽支持（预留）
```csharp
// 文件：Assets/Scripts/UI/PlayerInventory/InventoryUIController.cs
void EnableDragAndDrop(Button slot, UnifiedInventoryItem item)
{
    // 预留拖拽功能接口
    // 可用于后续实现物品拖拽到快捷栏、交易等功能
    
    slot.RegisterCallback<PointerDownEvent>(evt =>
    {
        if (evt.button == 0) // 左键
        {
            // 开始拖拽
            BeginDrag(item);
        }
    });
    
    slot.RegisterCallback<PointerUpEvent>(evt =>
    {
        // 结束拖拽
        EndDrag();
    });
}
```

#### 快捷键支持
```csharp
// 文件：Assets/Scripts/UI/PlayerInventory/InventoryUIController.cs
void RegisterHotkeys()
{
    root.RegisterCallback<KeyDownEvent>(evt =>
    {
        switch (evt.keyCode)
        {
            case KeyCode.Tab:
                // 切换分类
                CycleCategory();
                break;
            case KeyCode.S:
                // 排序
                OnSortButtonClicked();
                break;
            case KeyCode.Escape:
                // 关闭背包
                gameObject.SetActive(false);
                break;
        }
    });
}
```

## API接口

### 获取背包数据
**路径**: `inventory/get_inventory`
**方法**: POST

#### 请求
```json
{}
```

#### 响应
```json
{
    "inventory": [
        {
            "item_id": "Gold",
            "count": 10000
        },
        {
            "item_id": "Card_hero001",
            "count": 5
        }
    ]
}
```

### 更新物品数量
**路径**: `inventory/update_item`
**方法**: POST

#### 请求
```json
{
    "item_id": "Gold",
    "delta": 100
}
```

#### 响应
```json
{
    "current_balance": {
        "Gold": 10100
    }
}
```

## 错误处理

```csharp
// 文件：Assets/Scripts/Network/Core/Service/InventoryService.cs
void OnFullResp(MessageHub.Response r)
{
    if (r == null || r.code != 0)
    {
        Debug.LogWarning($"[Inv] 拉背包失败 code={r?.code} msg={r?.msg}");
        return;
    }

    ApplyFull(r.dataJson);
    Debug.Log($"[Inv] 全量同步完成：资源 {bag.Count} 条，碎片 {shards.Count} 条");
}
```

## 注意事项

1. **数据同步**
   - 背包数据以服务器为准，客户端只做缓存
   - 所有物品操作需要等待服务器响应后才更新UI
   - 使用乐观更新策略提升用户体验

2. **内存管理**
   - 物品图标使用Sprite缓存，避免重复加载
   - 大量物品时使用虚拟滚动优化性能
   - 及时清理不再使用的UI元素

3. **分类规则**
   - 装备和坐骑通过UUID唯一标识
   - 普通物品通过item_id标识
   - 碎片分为通用碎片和专用碎片

4. **排序优先级**
   - 稀有度高的物品排在前面
   - 同稀有度按等级排序
   - 同等级按数量排序

5. **使用限制**
   - 消耗品需要isUsable标记为true才能使用
   - 装备中的物品无法直接使用或删除
   - 某些物品有使用等级或条件限制

6. **UI渲染优化**
   - 使用ScrollViewPro的虚拟化功能减少渲染开销
   - 物品格子采用对象池技术复用
   - 延迟加载不在视口内的物品图标
   - 合理设置批处理以减少Draw Call

7. **响应式布局**
   - 网格会根据窗口大小自动调整列数
   - 最小保证每行1个物品，最多根据屏幕宽度计算
   - 物品格子大小固定，通过间距调整整体布局

8. **用户体验**
   - 选中物品有呼吸光效果
   - 鼠标悬停有放大效果
   - 点击反馈使用缩放动画
   - 支持键盘快捷键操作