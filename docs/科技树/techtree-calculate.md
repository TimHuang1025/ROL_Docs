# 个人科技树系统 - 核心算法文档


## 一、数据结构

### 1.1 进度数据存储
```csharp
// 文件：Assets/Scripts/SkillTree/TechProgressData.cs
public sealed class TechProgressData : ScriptableObject
{
    public int CurrentStage = 1;      // 当前阶段
    public string Progress = "";      // 进度字符串，如 "0032020020"
}
```

### 1.2 进度字符串格式
- **格式**：纯数字字符串，每个字符代表对应节点的等级
- **字符范围**：'0' 到 '9'
- **长度**：等于当前阶段的节点数量

**代码证明**：
```csharp
// 文件：Assets/Scripts/SkillTree/SkillTree.cs 第53-56行
int lvl = isPast ? maxLvl
        : isCurrent ? (progStr != null && i < progStr.Length ? 
                      int.Parse(progStr[i].ToString()) : 0)
        : 0;
```

## 二、加成计算

### 2.1 计算函数
```csharp
// 文件：Assets/Scripts/SkillTree/TechTreeCalculator.cs
public static Dictionary<string, float> Calc(int currentStage, string progress)
{
    if (_tree == null) LoadTree();
    
    var result = AllStatKeys.ToDictionary(k => k, _ => 0f);
    
    for (int stage = 1; stage <= currentStage; stage++)
    {
        if (!_tree.TryGetValue(stage, out var items)) continue;
        
        bool isCurrentStage = stage == currentStage;
        int progIdx = 0;
        
        foreach (var kv in items.OrderBy(k => k.Key))
        {
            var item = kv.Value;
            int maxLvl = item.MaxLevel;
            
            // 核心逻辑：当前阶段读取progress，过去阶段取满级
            int levelChar = isCurrentStage ? CharLevel(progress, progIdx) : maxLvl;
            
            int safeLevel = Mathf.Clamp(levelChar, 0,
                                        Math.Min(maxLvl, item.Values.Length));
            
            if (safeLevel > 0)
                result[item.StatName] += item.Values[safeLevel - 1];
            
            progIdx++;
        }
    }
    return result;
}
```

### 2.2 读取单个字符等级
```csharp
// 文件：Assets/Scripts/SkillTree/TechTreeCalculator.cs
static int CharLevel(string progress, int index) =>
    (index >= 0 && index < progress?.Length)
    && char.IsDigit(progress[index]) ? progress[index] - '0' : 0;
```

## 三、升级流程

### 3.1 客户端发起升级
```csharp
// 文件：Assets/Scripts/SkillTree/SkillTree.cs
private void OnUpgradeClicked()
{
    // 转换节点key为索引
    int nodeIndex = TechTreeService.ConvertKeyToIndex(curKey);
    
    // 标记升级状态
    nodeUpgradeStates[curKey] = true;
    isUpgrading = true;
    
    // 乐观更新UI
    optimisticLevels[curKey] = levelDict[curKey] + 1;
    UpdateNodeOptimistic(curKey, optimisticLevels[curKey]);
    
    // 发送升级请求
    TechTreeService.Instance.UpgradeTech(nodeIndex, 
        onSuccess: response => { /* 处理成功 */ },
        onError: error => { /* 处理失败 */ });
}
```

### 3.2 Key到Index转换
```csharp
// 文件：Assets/Scripts/Network/Core/Service/TechTreeService.cs
public static int ConvertKeyToIndex(string key)
{
    // key格式: "阶段-节点号"，如 "2-5"
    if (string.IsNullOrEmpty(key) || !key.Contains("-"))
        return -1;
    
    var parts = key.Split('-');
    if (parts.Length >= 2 && int.TryParse(parts[1], out int itemNum))
    {
        // 返回节点号本身
        // "1-1" → 1
        // "1-2" → 2
        return itemNum;
    }
    
    return -1;
}
```

### 3.3 服务器响应处理
```csharp
// 文件：Assets/Scripts/SkillTree/SkillTree.cs
private void OnServerUpgraded(int stage, string serverProgress)
{
    // 检查阶段是否变化
    bool stageChanged = progressAsset != null && progressAsset.CurrentStage != stage;
    
    // 更新本地数据
    if (progressAsset != null)
    {
        progressAsset.CurrentStage = stage;
        progressAsset.Progress = serverProgress;
        progressAsset.RecalculateBonus();
    }
    
    // 如果阶段变化，切换显示
    if (currentStageKey != stage.ToString())
    {
        currentStageKey = stage.ToString();
        ShowStage(currentStageKey);
        
        if (stageChanged)
        {
            PopupManager.Show("恭喜", $"进入第 {stage} 阶段！", 2f);
        }
    }
    else
    {
        // 同阶段内，批量更新节点
        UpdateNodesFromProgress(serverProgress);
    }
}
```

## 四、升级队列机制

### 4.1 队列管理
```csharp
// 文件：Assets/Scripts/Network/Core/Service/TechTreeService.cs
public void UpgradeTechQueued(int nodeIndex, 
                              Action<UpgradeTechResponse> onSuccess = null, 
                              Action<string> onError = null)
{
    // 检查是否已在升级中
    lock (nodeUpgradeStatus)
    {
        if (nodeUpgradeStatus.ContainsKey(nodeIndex) && 
            nodeUpgradeStatus[nodeIndex])
        {
            onError?.Invoke("该技能正在升级中");
            return;
        }
        nodeUpgradeStatus[nodeIndex] = true;
    }
    
    // 创建队列项
    var queueItem = new UpgradeQueueItem
    {
        NodeIndex = nodeIndex,
        OnSuccess = onSuccess,
        OnError = onError,
        ExpectedLevel = GetNodeLevel(nodeIndex) + 1,
        QueueTime = Time.time
    };
    
    // 加入队列
    lock (upgradeQueue)
    {
        upgradeQueue.Enqueue(queueItem);
    }
    
    // 开始处理队列
    if (!isProcessingUpgrade)
    {
        StartCoroutine(ProcessUpgradeQueue());
    }
}
```

### 4.2 队列处理协程
```csharp
// 文件：Assets/Scripts/Network/Core/Service/TechTreeService.cs
private IEnumerator ProcessUpgradeQueue()
{
    isProcessingUpgrade = true;
    
    while (true)
    {
        UpgradeQueueItem currentItem = null;
        
        // 从队列取出
        lock (upgradeQueue)
        {
            if (upgradeQueue.Count == 0) break;
            currentItem = upgradeQueue.Dequeue();
        }
        
        if (currentItem != null)
        {
            // 执行请求
            bool requestCompleted = false;
            ExecuteUpgradeRequest(currentItem, 
                (response) => { requestCompleted = true; },
                (error) => { requestCompleted = true; });
            
            // 等待完成（最多15秒）
            float timeout = 15f;
            while (!requestCompleted && timeout > 0)
            {
                yield return new WaitForSeconds(0.1f);
                timeout -= 0.1f;
            }
            
            // 清除升级状态
            lock (nodeUpgradeStatus)
            {
                nodeUpgradeStatus[currentItem.NodeIndex] = false;
            }
            
            // 短暂延迟
            yield return new WaitForSeconds(0.2f);
        }
    }
    
    isProcessingUpgrade = false;
}
```

## 五、响应验证

### 5.1 验证升级响应
```csharp
// 文件：Assets/Scripts/Network/Core/Service/TechTreeService.cs
private bool ValidateUpgradeResponse(UpgradeTechResponse response, 
                                    UpgradeQueueItem queueItem)
{
    if (string.IsNullOrEmpty(response.progress))
    {
        Debug.LogError("[TechTreeService] Invalid progress: null or empty");
        return false;
    }
    
    // 注意：节点索引是从1开始的，访问字符串时要-1
    int progressIndex = queueItem.NodeIndex - 1;
    
    if (progressIndex < 0 || progressIndex >= response.progress.Length)
    {
        Debug.LogError($"[TechTreeService] Node index {queueItem.NodeIndex} out of range");
        return false;
    }
    
    // 检查新等级
    if (char.IsDigit(response.progress[progressIndex]))
    {
        int newLevel = response.progress[progressIndex] - '0';
        Debug.Log($"[TechTreeService] Node {queueItem.NodeIndex} new level: {newLevel}");
        
        // 如果新等级大于等于预期等级，认为升级成功
        return newLevel >= queueItem.ExpectedLevel;
    }
    
    return false;
}
```

**注意**：代码中有注释"即使验证失败，如果数据看起来合理，还是接受它"，说明验证不是强制的。

### 5.2 Workaround处理
```csharp
// 文件：Assets/Scripts/Network/Core/Service/TechTreeService.cs
private bool TryParseWithWorkaround(string dataJson, out UpgradeTechResponse result)
{
    result = null;
    
    try
    {
        // 使用正则表达式提取关键数据
        var stageMatch = Regex.Match(dataJson, @"""stage"":(\d+)");
        var progressMatch = Regex.Match(dataJson, @"""progress"":""([^""]+)""");
        
        if (stageMatch.Success && progressMatch.Success)
        {
            result = new UpgradeTechResponse
            {
                stage = int.Parse(stageMatch.Groups[1].Value),
                progress = progressMatch.Groups[1].Value],
                current_balance = null
            };
            
            // 尝试提取余额
            var techScrollMatch = Regex.Match(dataJson, @"""TechScroll"":(\d+)");
            if (techScrollMatch.Success)
            {
                result.current_balance = new CurrentBalance
                {
                    TechScroll = long.Parse(techScrollMatch.Groups[1].Value)
                };
            }
            
            return true;
        }
    }
    catch (Exception ex)
    {
        Debug.LogError($"[TechTreeService] Workaround failed: {ex.Message}");
    }
    
    return false;
}
```

## 六、乐观更新

### 6.1 应用乐观更新
```csharp
// 文件：Assets/Scripts/SkillTree/SkillTree.cs
private void UpdateNodeOptimistic(string key, int optimisticLevel)
{
    if (!viewDict.TryGetValue(key, out var view)) return;
    
    // 更新等级槽位的视觉效果
    for (int i = 0; i < view.lvSlots.Count && i < optimisticLevel; i++)
    {
        var slot = view.lvSlots[i];
        slot.AddToClassList("optimistic");
        UpdateSlotVisual(slot, true);
    }
    
    // 添加升级中的视觉效果
    view.root.AddToClassList("upgrading");
}
```

### 6.2 回滚乐观更新
```csharp
// 文件：Assets/Scripts/SkillTree/SkillTree.cs
private void RollbackOptimisticUpdate(string key, int actualLevel)
{
    if (!viewDict.TryGetValue(key, out var view)) return;
    
    // 恢复实际等级的视觉效果
    for (int i = 0; i < view.lvSlots.Count; i++)
    {
        var slot = view.lvSlots[i];
        slot.RemoveFromClassList("optimistic");
        UpdateSlotVisual(slot, i < actualLevel);
    }
    
    // 移除升级中的视觉效果
    view.root.RemoveFromClassList("upgrading");
}
```

## 七、显示阶段逻辑

### 7.1 显示某个阶段
```csharp
// 文件：Assets/Scripts/SkillTree/SkillTree.cs
private void ShowStage(string sKey)
{
    // 清理旧数据
    ClearRows();
    levelDict.Clear();
    viewDict.Clear();
    keyToIdx.Clear();
    
    // 确定等级
    int curStageIdx = progressAsset ? progressAsset.CurrentStage : 1;
    bool isPast = int.Parse(sKey) < curStageIdx;
    bool isCurrent = int.Parse(sKey) == curStageIdx;
    string progStr = isCurrent ? progressAsset?.Progress : null;
    
    // 遍历节点，确定等级
    for (int i = 0; i < items.Count; i++)
    {
        int lvl = isPast ? maxLvl  // 过去阶段：满级
                : isCurrent ? (progStr != null && i < progStr.Length ? 
                              int.Parse(progStr[i].ToString()) : 0)  // 当前阶段：从进度读取
                : 0;  // 未来阶段：0级
        
        levelDict[key] = lvl;
    }
}
```

## 八、随机布局

### 8.1 生成随机布局
```csharp
// 文件：Assets/Scripts/SkillTree/SkillTree.cs（简化版本）
private List<int> GenerateRandomLayout(int count)
{
    var layout = new List<int>(count);
    for (int i = 0; i < count; i++)
    {
        layout.Add(UnityEngine.Random.Range(0, rows.Count));
    }
    return layout;
}
```

### 8.2 布局持久化
```csharp
// 文件：Assets/Scripts/SkillTree/SkillTree.cs
// 获取或生成布局
var rowLayout = progressAsset?.GetRowLayout(sKey) ?? GenerateRandomLayout(items.Count);
bool needSaveLayout = (progressAsset?.GetRowLayout(sKey) == null);

// 保存布局（如果是新生成的）
if (needSaveLayout && progressAsset)
    progressAsset.SetRowLayout(sKey, rowLayout);
```

## 九、错误处理

### 9.1 升级错误处理
```csharp
// 文件：Assets/Scripts/Network/Core/Service/TechTreeService.cs
private void HandleUpgradeError(int code, string msg, Action<string> onError)
{
    string errorMessage = msg;
    
    if (msg.Contains("Invalid upgrade type"))
    {
        errorMessage = "无效的升级类型";
    }
    else if (msg.Contains("already maxed out"))
    {
        errorMessage = "该科技已达到最高等级";
    }
    else if (msg.Contains("Insufficient TechScroll"))
    {
        // 尝试解析所需数量
        var parts = msg.Split(',');
        if (parts.Length >= 2)
        {
            var required = parts[0].Split(':')[1].Trim();
            var current = parts[1].Split(':')[1].Trim();
            errorMessage = $"科技卷轴不足\n需要: {required}\n当前: {current}";
        }
        else
        {
            errorMessage = "科技卷轴不足";
        }
    }
    
    Debug.LogError($"[TechTreeService] Upgrade error {code}: {msg}");
    onError?.Invoke(errorMessage);
}
```

## 十、关键事实

基于代码分析，以下是系统的关键事实：

1. **进度管理**：
   - 进度字符串每个字符代表一个节点等级（'0'-'9'）
   - 过去阶段的节点全部按满级计算
   - 当前阶段按进度字符串实际值计算

2. **升级流程**：
   - 客户端发送节点索引到服务器
   - 服务器返回新的stage和progress
   - 客户端根据返回值更新显示

3. **阶段进阶**：
   - 完全由服务器决定
   - 客户端无法得知进阶条件
   - 当stage变化时自动切换到新阶段

4. **队列机制**：
   - 防止同一节点重复升级
   - 按顺序处理升级请求
   - 每个请求间隔0.2秒

5. **容错处理**：
   - 有Workaround处理服务器响应格式问题
   - 验证失败但数据合理时仍接受
   - 超时15秒自动失败

6. **特殊情况**：
   - 阶段编号可能不连续（如1,2,3,4,5,6,8）
   - 节点索引从1开始，访问字符串时需要-1
   - 布局首次生成后永久保存

## 总结

本文档基于实际代码编写，所有算法和流程都有对应的代码实现。系统的核心是：

- **数据驱动**：所有显示基于服务器返回的stage和progress
- **客户端被动**：只负责显示和发送请求，不决定游戏逻辑
- **容错设计**：多种机制处理异常情况
- **性能优化**：队列机制避免并发，乐观更新提升体验

任何未在代码中明确的行为都由服务器控制。