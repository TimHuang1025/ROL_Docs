# UI Toolkit使用规范文档

## 概述

项目使用Unity的UI Toolkit技术构建用户界面，配合第三方插件ScrollViewPro实现高性能滚动列表。UI Toolkit采用类似Web的开发模式：UXML定义布局，USS控制样式，C#处理逻辑。

## 技术架构

### 核心组件

| 组件 | 作用 | 文件类型 |
|------|------|----------|
| **UIDocument** | UI文档组件 | MonoBehaviour组件 |
| **UXML** | 界面布局 | .uxml文件 |
| **USS** | 样式表 | .uss文件 |
| **VisualElement** | UI元素基类 | C#类 |
| **ScrollViewPro** | 高性能滚动 | 第三方插件 |

## UXML布局定义

### 基础UXML结构（实际代码）

```xml
<!-- ClanPageScroll.uxml - 实际的UXML文件 -->
<ui:UXML xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
         xmlns:ui="UnityEngine.UIElements" 
         xmlns:uie="UnityEditor.UIElements" 
         noNamespaceSchemaLocation="../../../../UIElementsSchema/UIElements.xsd" 
         editor-extension-mode="False">
    
    <Style src="project://database/Assets/Scripts/UI/ControlPanel/ControlPanel.uss?fileID=7433441132597879392&amp;guid=749f16dd27372984d91c3b052fcc9027&amp;type=3#ControlPanel" />
    
    <ui:VisualElement name="Container">
        <!-- 内容 -->
    </ui:VisualElement>
</ui:UXML>
```

### ScrollViewPro使用（实际代码）

```xml
<!-- 实际项目中的ScrollViewPro使用 -->
<Kamgam.UIToolkitScrollViewPro.ScrollViewPro 
    name="UnionListScrollView" 
    mode="Vertical" 
    horizontal-scroller-visibility="Hidden" 
    vertical-scroller-visibility="Hidden" 
    touch-scroll-type="Elastic">
    
    <ui:VisualElement name="LoadMoreIndicator" style="height: 60px;">
        <ui:Label text="加载中..." style="font-size: 24px;" />
    </ui:VisualElement>
</Kamgam.UIToolkitScrollViewPro.ScrollViewPro>
```

## C#控制逻辑

### UIDocument基础使用（实际代码）

```csharp
// MainMenuController.cs - 实际代码
[RequireComponent(typeof(UIDocument))]
public class MainMenuController : MonoBehaviour
{
    private UIDocument uiDocument;
    private Button clanBtn;
    private VisualElement profileIcon;
    
    void Awake()
    {
        uiDocument = GetComponent<UIDocument>();
    }
    
    void OnEnable()
    {
        var root = uiDocument.rootVisualElement;
        
        // 查找元素
        profileIcon = root.Q<VisualElement>("ProfileIcon");
        if (profileIcon == null)
        {
            Debug.LogError("[MainMenuController] 找不到名为 ProfileIcon 的元素");
            return;
        }
        
        // 设置可点击
        profileIcon.pickingMode = PickingMode.Position;
    }
}
```

### 查找UI元素（实际代码）

```csharp
// JoinUnionController.cs - 实际的元素查找代码
void InitUI()
{
    root = uiDocument.rootVisualElement;
    
    // 通过name查找
    backBtn = root.Q<Button>("BackBtn");
    searchInput = root.Q<TextField>("SearchInput");
    searchBtn = root.Q<Button>("SearchBtn");
    
    // 查找ScrollViewPro
    unionListScrollView = root.Q<ScrollViewPro>("UnionListScrollView");
    if (unionListScrollView == null)
    {
        unionListScrollView = root.Query<ScrollViewPro>().First();
    }
    
    // 获取容器
    if (unionListScrollView != null)
    {
        unionListContainer = unionListScrollView.Q<VisualElement>("unity-content-container");
        if (unionListContainer == null)
        {
            unionListContainer = new VisualElement();
            unionListContainer.name = "UnionListContainer";
            unionListScrollView.Add(unionListContainer);
        }
    }
}
```

### 事件绑定（实际代码）

```csharp
// JoinUnionController.cs - 实际的事件绑定代码
private void BindEvents()
{
    // 先清理旧的事件监听（重要！）
    backBtn?.UnregisterCallback<ClickEvent>(OnBackClicked);
    searchBtn?.UnregisterCallback<ClickEvent>(OnSearchClicked);
    createUnionBtn?.UnregisterCallback<ClickEvent>(OnCreateUnionClicked);
    
    // 注册新的事件监听
    backBtn?.RegisterCallback<ClickEvent>(OnBackClicked);
    searchBtn?.RegisterCallback<ClickEvent>(OnSearchClicked);
    createUnionBtn?.RegisterCallback<ClickEvent>(OnCreateUnionClicked);
    
    // 搜索框回车事件
    searchInput?.RegisterCallback<KeyDownEvent>(evt =>
    {
        if (evt.keyCode == KeyCode.Return || evt.keyCode == KeyCode.KeypadEnter)
        {
            OnSearchClicked(null);
        }
    });
}

private void OnBackClicked(ClickEvent evt)
{
    // 处理返回
}
```

## 动态创建UI

### 从模板创建（实际代码）

```csharp
// GachaFlipAnimation.cs - 实际的动态创建代码
private void CreateCardElement(int index)
{
    // 创建容器
    var wrapper = new VisualElement();
    wrapper.name = $"card-wrapper-{index}";
    wrapper.AddToClassList(USS_CARD_WRAPPER);
    
    // 创建卡片
    var card = new VisualElement();
    card.name = $"card-{index}";
    card.AddToClassList(USS_CARD);
    
    // 创建内容
    var content = new VisualElement();
    content.name = "card-content";
    content.AddToClassList(USS_CARD_CONTENT);
    
    // 组装层级
    card.Add(content);
    wrapper.Add(card);
    container.Add(wrapper);
}
```

### 修改样式（实际代码）

```csharp
// HeroArrangePanel.cs - 实际的样式修改代码
private void UpdateTroopTypeWidths()
{
    float totalWidth = logisticsContainerWidth;
    
    // 计算实际宽度
    float actualInfantryWidth = totalWidth * infantryRatio;
    float actualCavalryWidth = totalWidth * cavalryRatio;
    float actualArcherWidth = totalWidth * archerRatio;
    
    // 应用样式
    infantry.style.width = actualInfantryWidth;
    cavalry.style.width = actualCavalryWidth;
    archer.style.width = actualArcherWidth;
    
    // 更新标签
    infantryLabel.text = $"步兵 {(int)(infantryRatio * 100)}%";
    cavalryLabel.text = $"骑兵 {(int)(cavalryRatio * 100)}%";
    archerLabel.text = $"弓兵 {(int)(archerRatio * 100)}%";
}
```

## ScrollViewPro使用

### 配置ScrollViewPro（实际代码）

```csharp
// HeroSelectionPanel.cs - 实际的ScrollViewPro配置
void InitializeUI()
{
    // 配置 ScrollView
    scrollView.mode = ScrollViewMode.Vertical;
    scrollView.horizontalScrollerVisibility = ScrollerVisibility.Hidden;
    scrollView.verticalScrollerVisibility = ScrollerVisibility.Hidden;
    
    // 重置滚动位置
    scrollView.scrollOffset = Vector2.zero;
}

// 滚动到指定元素
public void ScrollToCard(string cardId)
{
    if (string.IsNullOrEmpty(cardId) || scrollView == null) return;
    
    if (!cardElements.TryGetValue(cardId, out var cardElement))
    {
        return;
    }
    
    scrollView.schedule.Execute(() =>
    {
        var rowContainer = cardElement.parent;
        if (rowContainer == null) return;
        
        // 使用 ScrollViewPro 的滚动功能
        scrollView.ScrollTo(rowContainer);
    }).ExecuteLater(50);
}
```

### 虚拟化滚动（实际使用）

```xml
<!-- CardInventory.uxml - 实际的配置 -->
<Kamgam.UIToolkitScrollViewPro.ScrollViewPro 
    name="CardScrollView" 
    snap-edge-clamp-y="true"
    touch-scroll-type="Elastic"
    scroller-buttons="false"
    vertical-scroller-visibility="Hidden">
    <!-- 内容 -->
</Kamgam.UIToolkitScrollViewPro.ScrollViewPro>
```

## USS样式

### 实际的USS文件示例

```css
/* ControlPanel.uss - 实际的样式文件片段 */
.gacha-card {
    width: 200px;
    height: 280px;
    background-color: #2a2a2a;
    border-radius: 10px;
    margin: 10px;
}

.gacha-card-content {
    flex-grow: 1;
    padding: 10px;
    align-items: center;
    justify-content: center;
}

.gacha-card-icon {
    width: 120px;
    height: 120px;
    background-size: contain;
}
```

### 动态修改样式（实际代码）

```csharp
// ClanArchiveController.cs - 实际的样式操作
private void SetTabActive(Button btn, VisualElement content)
{
    // 重置所有标签
    battleTabBtn?.RemoveFromClassList("active-tab");
    allianceTabBtn?.RemoveFromClassList("active-tab");
    personnelTabBtn?.RemoveFromClassList("active-tab");
    
    // 激活当前标签
    btn?.AddToClassList("active-tab");
    
    // 显示对应内容
    battleContent?.style.display = DisplayStyle.None;
    allianceContent?.style.display = DisplayStyle.None;
    personnelContent?.style.display = DisplayStyle.None;
    
    content?.style.display = DisplayStyle.Flex;
}
```

## 最佳实践

### 1. 元素查找缓存

```csharp
// 缓存查找结果，避免重复查找（实际代码）
private Button clanBtn;
private VisualElement profileIcon;

void OnEnable()
{
    var root = uiDocument.rootVisualElement;
    
    // 只查找一次并缓存
    if (profileIcon == null)
        profileIcon = root.Q<VisualElement>("ProfileIcon");
    
    if (clanBtn == null)
        clanBtn = root.Q<Button>("ClanBtn");
}
```

### 2. 事件清理

```csharp
// 清理事件避免内存泄漏（实际代码）
void OnDisable()
{
    // 清理事件订阅
    backBtn?.UnregisterCallback<ClickEvent>(OnBackClicked);
    searchBtn?.UnregisterCallback<ClickEvent>(OnSearchClicked);
    
    // 清理协程
    if (loadingCoroutine != null)
    {
        StopCoroutine(loadingCoroutine);
        loadingCoroutine = null;
    }
}
```

### 3. 空值检查

```csharp
// 始终进行空值检查（实际代码）
void UpdateUI()
{
    if (nameLabel != null)
        nameLabel.text = unionInfo?.name ?? "";
    
    if (levelLabel != null)
        levelLabel.text = $"Lv.{unionInfo?.level ?? 1}";
}
```

## 常见问题

### Q: 找不到UI元素？

```csharp
// 使用多种查找方式（实际代码）
// 1. 通过name查找
var element = root.Q<Button>("ButtonName");

// 2. 通过类型查找第一个
var scrollView = root.Query<ScrollViewPro>().First();

// 3. 通过class查找
var buttons = root.Query<Button>(className: "my-button").ToList();
```

### Q: ScrollViewPro内容容器在哪？

```csharp
// ScrollViewPro的内容容器（实际代码）
var container = scrollView.Q<VisualElement>("unity-content-container");
if (container == null)
{
    // 如果找不到，创建一个
    container = new VisualElement();
    scrollView.Add(container);
}
```

### Q: 如何处理中文字体？

```xml
<!-- UXML中引用中文字体（实际代码） -->
<ui:Label text="档案阁" 
    style="font-size: 48px; 
    -unity-font-definition: url('project://database/Assets/Assets/UI/中文font_dingliesongketi.ttf?fileID=12800000&amp;guid=bd77ce5c718bc0e47b01c5156d0863d8&amp;type=3#中文font_dingliesongketi');" />
```

## 性能优化

### 1. 对象池复用

```csharp
// PhantomClonePanel.cs - 实际的对象池使用
private Stack<VisualElement> cardPool = new Stack<VisualElement>();

private VisualElement GetCardElement()
{
    if (cardPool.Count > 0)
        return cardPool.Pop();
    
    return CreateNewCardElement();
}

private void ReturnToPool(VisualElement element)
{
    element.style.display = DisplayStyle.None;
    cardPool.Push(element);
}
```

### 2. 批量更新

```csharp
// 批量更新减少重绘（建议做法）
scrollView.schedule.Execute(() =>
{
    // 批量更新多个元素
    foreach (var item in items)
    {
        UpdateItem(item);
    }
}).ExecuteLater(16); // 下一帧执行
```

## 注意事项

1. **UIDocument必须附加到GameObject** - 不能单独存在
2. **UXML路径使用GUID** - 避免文件移动后失效  
3. **ScrollViewPro需要Pro版本** - 免费版功能受限
4. **中文字体需要特殊处理** - 使用-unity-font-definition
5. **事件必须及时清理** - 避免内存泄漏
6. **样式优先级** - inline style > USS class > USS type