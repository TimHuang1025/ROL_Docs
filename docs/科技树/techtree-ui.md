# UI交互文档

## UI结构概述

### 界面布局
```
┌─────────────────────────────────────────────┐
│  返回  │   阶段1  阶段2  阶段3 ...   │ 科技卷轴 │  <- 顶部导航栏
├─────────────────────────────────────────────┤
│                                             │
│    [节点] [节点] [节点] [节点] [节点]        │  <- 技能节点区
│    [节点] [节点] [节点] [节点] [节点]        │     (5行布局)
│    [节点] [节点] [节点] [节点] [节点]        │
│    [节点] [节点] [节点] [节点] [节点]        │
│    [节点] [节点] [节点] [节点] [节点]        │
│                                             │
├─────────────────────────────────────────────┤
│  技能名称: 募兵速度                          │  <- 详情面板
│  等级: Lv.3/5                               │
│  当前效果: +9%                              │
│  下一级: +14%                               │
│  升级消耗: 1000/2500                        │
│  [升级按钮]                                 │
└─────────────────────────────────────────────┘
```

## UI元素定义

### SkillTreeRoot.uxml 主界面模板
```xml
<!-- 文件：Assets/Scripts/SkillTree/SkillTreeRoot.uxml -->
<ui:UXML xmlns:ui="UnityEngine.UIElements">
    <ui:VisualElement name="TreeRoot">
        <!-- 顶部导航 -->
        <ui:VisualElement name="Top">
            <ui:Button name="ReturnBtn" text="<返回" />
            <ScrollViewPro name="StageScrollView">
                <!-- 动态生成阶段按钮 -->
            </ScrollViewPro>
            <ui:Label name="playermat" text="0" />
        </ui:VisualElement>
        
        <!-- 技能节点区域 -->
        <ui:VisualElement name="skill-row" />
        <ui:VisualElement name="skill-row" />
        <ui:VisualElement name="skill-row" />
        <ui:VisualElement name="skill-row" />
        <ui:VisualElement name="skill-row" />
        
        <!-- 详情面板 -->
        <ui:VisualElement name="description">
            <ui:Label name="skilltitle" />
            <ui:Label name="skilllv" />
            <ui:Label name="skilldescription" />
            <ui:Label name="currentEffect" />
            <ui:Label name="nextEffect" />
            <ui:Label name="needtitle" />
            <ui:Label name="skillupgradeneed" />
            <ui:Button name="upgradeBtn" />
        </ui:VisualElement>
    </ui:VisualElement>
</ui:UXML>
```

### SkillNode.uxml 节点模板
```xml
<!-- 文件：Assets/Scripts/SkillTree/SkillNode.uxml -->
<ui:UXML xmlns:ui="UnityEngine.UIElements">
    <ui:VisualElement name="skill-container">
        <ui:VisualElement name="icon" />
        <ui:VisualElement>
            <!-- 等级槽位，动态生成 -->
            <ui:VisualElement name="lvslot" class="lvslot" />
        </ui:VisualElement>
    </ui:VisualElement>
</ui:UXML>
```

## 节点状态管理

### 节点视觉状态
```csharp
// 文件：Assets/Scripts/SkillTree/SkillTree.cs
private void UpdateNodeVisualState(SkillView view, int level, int maxLevel, bool isSelected)
{
    var container = view.root;
    
    // 清除所有状态类
    container.RemoveFromClassList("locked");
    container.RemoveFromClassList("unlocked");
    container.RemoveFromClassList("maxed");
    container.RemoveFromClassList("selected");
    
    // 应用新状态
    if (level == 0)
    {
        // 未解锁状态
        container.AddToClassList("locked");
        container.style.opacity = 0.5f;
    }
    else if (level >= maxLevel)
    {
        // 满级状态
        container.AddToClassList("maxed");
        container.style.backgroundColor = new Color(1f, 0.84f, 0f, 0.1f);
    }
    else
    {
        // 普通解锁状态
        container.AddToClassList("unlocked");
        container.style.opacity = 1f;
    }
    
    // 选中状态
    if (isSelected)
    {
        container.AddToClassList("selected");
        container.style.scale = new Scale(Vector3.one * 1.1f);
        
        // 添加选中边框
        container.style.borderTopWidth = 3;
        container.style.borderBottomWidth = 3;
        container.style.borderLeftWidth = 3;
        container.style.borderRightWidth = 3;
        container.style.borderTopColor = selectedColor;
        container.style.borderBottomColor = selectedColor;
        container.style.borderLeftColor = selectedColor;
        container.style.borderRightColor = selectedColor;
    }
}
```

### 等级槽位显示
```csharp
private void UpdateLevelSlots(SkillView view, int currentLevel, int maxLevel)
{
    // 确保有足够的槽位
    while (view.lvSlots.Count < maxLevel)
    {
        var slot = new VisualElement();
        slot.AddToClassList("lvslot");
        slot.style.width = 50;
        slot.style.height = 50;
        view.lvSlots.Add(slot);
    }
    
    // 更新每个槽位的显示
    for (int i = 0; i < maxLevel; i++)
    {
        var slot = view.lvSlots[i];
        
        if (i < currentLevel)
        {
            // 已解锁的槽位
            slot.style.backgroundImage = new StyleBackground(unlockedSlotSprite);
            slot.style.unityBackgroundImageTintColor = new Color(1f, 0.84f, 0f);
        }
        else
        {
            // 未解锁的槽位
            slot.style.backgroundImage = new StyleBackground(lockedSlotSprite);
            slot.style.unityBackgroundImageTintColor = Color.gray;
        }
    }
}
```

## 用户交互处理

### 节点点击事件
```csharp
private void OnNodeClicked(string key, SkillView view)
{
    Debug.Log($"[ProSkillTree] Node clicked: {key}");
    
    // 取消之前的选中
    if (currentSelectedSlot != null)
    {
        currentSelectedSlot.RemoveFromClassList("selected");
        currentSelectedSlot.style.scale = new Scale(Vector3.one);
        currentSelectedSlot.style.borderTopWidth = 0;
        currentSelectedSlot.style.borderBottomWidth = 0;
        currentSelectedSlot.style.borderLeftWidth = 0;
        currentSelectedSlot.style.borderRightWidth = 0;
    }
    
    // 设置新的选中
    curKey = key;
    curView = view;
    currentSelectedSlot = view.root;
    
    // 更新视觉状态
    UpdateNodeVisualState(view, levelDict[key], dataDict[key].maxLvl, true);
    
    // 更新详情面板
    UpdateDetailPanel();
    
    // 播放选中音效
    PlaySelectSound();
}
```

### 悬停提示
```csharp
private void SetupHoverEvents(SkillView view, string key)
{
    var container = view.root;
    
    // 鼠标进入
    container.RegisterCallback<MouseEnterEvent>(evt =>
    {
        if (curKey != key) // 非选中状态才显示悬停效果
        {
            container.style.scale = new Scale(Vector3.one * 1.05f);
            ShowHoverTooltip(view, key);
        }
    });
    
    // 鼠标离开
    container.RegisterCallback<MouseLeaveEvent>(evt =>
    {
        if (curKey != key)
        {
            container.style.scale = new Scale(Vector3.one);
            HideHoverTooltip();
        }
    });
}

private void ShowHoverTooltip(SkillView view, string key)
{
    // 创建悬停提示
    if (view.hoverLabel == null)
    {
        view.hoverLabel = new Label();
        view.hoverLabel.style.position = Position.Absolute;
        view.hoverLabel.style.backgroundColor = new Color(0, 0, 0, 0.8f);
        view.hoverLabel.style.color = Color.white;
        view.hoverLabel.style.padding = new StyleLength(10);
        view.hoverLabel.style.borderRadius = new StyleLength(5);
    }
    
    var data = dataDict[key];
    var level = levelDict[key];
    
    view.hoverLabel.text = $"{GetSkillName(data.type)}\n" +
                          $"等级: {level}/{data.maxLvl}\n" +
                          $"效果: {FormatBonus(data.type, data.gains[Math.Max(0, level-1)])}";
    
    view.root.Add(view.hoverLabel);
}
```

### 升级按钮交互
```csharp
private void OnUpgradeClicked()
{
    if (curKey == null || isUpgrading) return;
    
    // 检查升级条件
    var data = dataDict[curKey];
    int level = levelDict[curKey];
    
    // 1. 检查是否满级
    if (level >= data.maxLvl)
    {
        PopupManager.Show("提示", "该技能已满级", 1.5f);
        return;
    }
    
    // 2. 检查资源
    long need = data.costs[level];
    long have = GetTechScrollCount();
    
    if (have < need)
    {
        PopupManager.Show("提示", $"科技卷轴不足\n需要: {need}\n当前: {have}", 2f);
        return;
    }
    
    // 3. 执行升级
    StartUpgrade();
}

private void StartUpgrade()
{
    // 禁用按钮
    isUpgrading = true;
    upgradeBtn.text = "升级中...";
    upgradeBtn.SetEnabled(false);
    
    // 乐观更新
    optimisticLevels[curKey] = levelDict[curKey] + 1;
    UpdateNodeOptimistic(curKey, optimisticLevels[curKey]);
    
    // 发送请求
    int nodeIndex = TechTreeService.ConvertKeyToIndex(curKey);
    TechTreeService.Instance.UpgradeTech(nodeIndex, OnUpgradeSuccess, OnUpgradeError);
}
```

## 动画效果

### 升级成功动画
```csharp
private void ShowUpgradeAnimation(string key, float oldValue, float newValue)
{
    if (!viewDict.TryGetValue(key, out var view)) return;
    
    // 1. 节点闪光效果
    StartCoroutine(NodeFlashAnimation(view.root));
    
    // 2. 数值飘动
    StartCoroutine(FloatingNumberAnimation(view.root, oldValue, newValue));
    
    // 3. 粒子效果
    PlayUpgradeParticles(view.root.worldBound.center);
    
    // 4. 音效
    PlayUpgradeSound();
}

private IEnumerator NodeFlashAnimation(VisualElement node)
{
    Color originalColor = node.style.backgroundColor.value;
    Color flashColor = new Color(1f, 1f, 0.5f, 1f);
    
    float duration = 0.5f;
    float elapsed = 0f;
    
    while (elapsed < duration)
    {
        elapsed += Time.deltaTime;
        float t = elapsed / duration;
        
        // 闪烁3次
        float flash = Mathf.Sin(t * Mathf.PI * 3) * 0.5f + 0.5f;
        node.style.backgroundColor = Color.Lerp(originalColor, flashColor, flash);
        
        yield return null;
    }
    
    node.style.backgroundColor = originalColor;
}
```

### 数值飘动动画
```csharp
private IEnumerator FloatingNumberAnimation(VisualElement anchor, float oldVal, float newVal)
{
    // 创建飘动文字
    var floatingText = floatingTextTemplate.CloneTree().Q<Label>("floating-text");
    
    // 设置文字内容
    float diff = newVal - oldVal;
    floatingText.text = $"+{FormatBonus(curView.data.type, diff)}";
    floatingText.style.color = new Color(0.2f, 1f, 0.2f);
    floatingText.style.fontSize = 40;
    
    // 设置初始位置
    var startPos = anchor.worldBound.center;
    floatingText.style.position = Position.Absolute;
    floatingText.style.left = startPos.x;
    floatingText.style.top = startPos.y;
    
    root.Add(floatingText);
    
    // 动画参数
    float duration = 1.5f;
    float distance = 100f;
    AnimationCurve curve = AnimationCurve.EaseInOut(0, 0, 1, 1);
    
    float elapsed = 0f;
    while (elapsed < duration)
    {
        elapsed += Time.deltaTime;
        float t = elapsed / duration;
        
        // 位置动画（向上飘动）
        float y = startPos.y - distance * curve.Evaluate(t);
        floatingText.style.top = y;
        
        // 透明度渐变
        float alpha = Mathf.Lerp(1f, 0f, t);
        var color = floatingText.style.color.value;
        color.a = alpha;
        floatingText.style.color = color;
        
        // 缩放动画
        float scale = Mathf.Lerp(1f, 1.5f, curve.Evaluate(t));
        floatingText.style.scale = new Scale(Vector3.one * scale);
        
        yield return null;
    }
    
    floatingText.RemoveFromHierarchy();
}
```

### 进阶动画
```csharp
private IEnumerator StageAdvanceAnimation(int newStage)
{
    // 创建全屏遮罩
    var overlay = new VisualElement();
    overlay.style.position = Position.Absolute;
    overlay.style.width = Length.Percent(100);
    overlay.style.height = Length.Percent(100);
    overlay.style.backgroundColor = new Color(0, 0, 0, 0);
    root.Add(overlay);
    
    // 渐入黑屏
    float fadeInTime = 0.3f;
    float elapsed = 0f;
    
    while (elapsed < fadeInTime)
    {
        elapsed += Time.deltaTime;
        float alpha = elapsed / fadeInTime * 0.7f;
        overlay.style.backgroundColor = new Color(0, 0, 0, alpha);
        yield return null;
    }
    
    // 显示进阶文字
    var stageText = new Label($"进入第 {newStage} 阶段！");
    stageText.style.fontSize = 80;
    stageText.style.color = new Color(1f, 0.84f, 0f);
    stageText.style.position = Position.Absolute;
    stageText.style.width = Length.Percent(100);
    stageText.style.height = Length.Percent(100);
    stageText.style.unityTextAlign = TextAnchor.MiddleCenter;
    overlay.Add(stageText);
    
    // 文字动画
    yield return StartCoroutine(TextPunchAnimation(stageText));
    
    // 等待
    yield return new WaitForSeconds(1f);
    
    // 渐出
    elapsed = 0f;
    while (elapsed < fadeInTime)
    {
        elapsed += Time.deltaTime;
        float alpha = 0.7f * (1f - elapsed / fadeInTime);
        overlay.style.backgroundColor = new Color(0, 0, 0, alpha);
        stageText.style.opacity = 1f - elapsed / fadeInTime;
        yield return null;
    }
    
    overlay.RemoveFromHierarchy();
}
```

## 响应式布局

### 自适应节点排列
```csharp
private void ArrangeNodes(List<VisualElement> nodes, List<int> rowLayout)
{
    // 获取每行的容器
    var rows = FindRows();
    
    // 清空所有行
    foreach (var row in rows)
    {
        row.Clear();
    }
    
    // 统计每行节点数
    int[] rowCounts = new int[5];
    for (int i = 0; i < rowLayout.Count; i++)
    {
        rowCounts[rowLayout[i]]++;
    }
    
    // 分配节点到各行
    int[] currentIndices = new int[5];
    for (int i = 0; i < nodes.Count && i < rowLayout.Count; i++)
    {
        int rowIndex = rowLayout[i];
        var row = rows[rowIndex];
        var node = nodes[i];
        
        // 计算节点间距
        float spacing = 100f / (rowCounts[rowIndex] + 1);
        float position = spacing * (currentIndices[rowIndex] + 1);
        
        // 设置节点位置
        node.style.left = Length.Percent(position - 5); // 5%为节点半宽
        node.style.position = Position.Absolute;
        
        row.Add(node);
        currentIndices[rowIndex]++;
    }
}
```

### 屏幕适配
```csharp
private void AdaptToScreenSize()
{
    float screenWidth = Screen.width;
    float screenHeight = Screen.height;
    float aspectRatio = screenWidth / screenHeight;
    
    // 根据屏幕比例调整UI缩放
    if (aspectRatio < 1.5f) // 竖屏或接近正方形
    {
        root.style.scale = new Scale(Vector3.one * 0.8f);
    }
    else if (aspectRatio > 2f) // 超宽屏
    {
        root.style.scale = new Scale(Vector3.one * 1.2f);
    }
    
    // 调整详情面板位置
    var descPanel = root.Q("description");
    if (aspectRatio < 1.5f)
    {
        // 竖屏时面板在底部
        descPanel.style.position = Position.Absolute;
        descPanel.style.bottom = 0;
        descPanel.style.width = Length.Percent(100);
        descPanel.style.height = Length.Percent(30);
    }
    else
    {
        // 横屏时面板在右侧
        descPanel.style.position = Position.Absolute;
        descPanel.style.right = 0;
        descPanel.style.width = Length.Percent(25);
        descPanel.style.height = Length.Percent(100);
    }
}
```

## 性能优化

### 对象池管理
```csharp
private class NodePool
{
    private Stack<VisualElement> available = new Stack<VisualElement>();
    private VisualTreeAsset template;
    
    public NodePool(VisualTreeAsset nodeTemplate)
    {
        this.template = nodeTemplate;
    }
    
    public VisualElement Get()
    {
        if (available.Count > 0)
        {
            return available.Pop();
        }
        return template.CloneTree();
    }
    
    public void Return(VisualElement node)
    {
        // 重置状态
        node.RemoveFromClassList("selected");
        node.RemoveFromClassList("locked");
        node.RemoveFromClassList("maxed");
        node.style.scale = new Scale(Vector3.one);
        
        available.Push(node);
    }
}
```

### 批量更新优化
```csharp
private void BatchUpdateNodes(Dictionary<string, int> updates)
{
    // 收集所有需要更新的节点
    var dirtyNodes = new List<string>();
    
    foreach (var kvp in updates)
    {
        if (levelDict.ContainsKey(kvp.Key) && 
            levelDict[kvp.Key] != kvp.Value)
        {
            dirtyNodes.Add(kvp.Key);
        }
    }
    
    // 批量更新
    root.schedule.Execute(() =>
    {
        foreach (var key in dirtyNodes)
        {
            if (viewDict.TryGetValue(key, out var view))
            {
                int newLevel = updates[key];
                levelDict[key] = newLevel;
                UpdateNodeVisual(view, newLevel);
            }
        }
    }).StartingIn(0);
}