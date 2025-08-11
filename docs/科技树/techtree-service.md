# 网络通信文档

## API接口定义

### 获取科技树数据
**路径**: `techtree/get_techtree`  
**方法**: POST

#### 请求
```csharp
// 文件：Assets/Scripts/Network/Core/Service/TechTreeService.cs
[Serializable]
public class GetTechTreeRequest
{
    // 请求体为空，根据用户token自动获取数据
}
```

#### 响应
```csharp
[Serializable]
public class GetTechTreeResponse
{
    public TechTreeData techtree;
}

[Serializable]
public class TechTreeData
{
    public string cid;          // 角色ID
    public int stage;           // 当前阶段 (1-8)
    public int total;           // 总节点数
    public int complete;        // 已完成节点数
    public string progress;     // 进度字符串 "0032020020"
    public long updated_at;     // 最后更新时间戳
}
```

#### 示例响应
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "techtree": {
      "cid": "player_12345",
      "stage": 2,
      "total": 14,
      "complete": 7,
      "progress": "5533220110",
      "updated_at": 1704067200000
    }
  }
}
```

### 升级科技节点
**路径**: `techtree/upgrade`  
**方法**: POST

#### 请求
```csharp
[Serializable]
public class UpgradeTechRequest
{
    public int type;  // 节点索引(从0开始)
}
```

#### 响应
```csharp
[Serializable]
public class UpgradeTechResponse
{
    public int stage;               // 更新后的阶段
    public string progress;         // 更新后的进度
    public CurrentBalance current_balance;  // 更新后的资源
}

[Serializable]
public class CurrentBalance
{
    public long TechScroll;         // 剩余科技卷轴数量
}
```

#### 示例响应
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "stage": 2,
    "progress": "5533220210",
    "current_balance": {
      "TechScroll": 4500
    }
  }
}
```

## 网络服务实现

### TechTreeService 核心实现
```csharp
// 文件：Assets/Scripts/Network/Core/Service/TechTreeService.cs
public class TechTreeService : MonoBehaviour
{
    // 单例实例
    public static TechTreeService Instance { get; private set; }
    
    // 事件定义
    public event Action<TechTreeData> OnTechTreeDataReceived;
    public event Action<int, string> OnTechTreeUpgraded;
    
    // 升级队列管理
    private Queue<UpgradeQueueItem> upgradeQueue = new Queue<UpgradeQueueItem>();
    private bool isProcessingUpgrade = false;
    private Dictionary<int, bool> nodeUpgradeStatus = new Dictionary<int, bool>();
}
```

### 获取科技树数据
```csharp
public void GetTechTree(Action<TechTreeData> onSuccess = null, 
                        Action<string> onError = null)
{
    var request = new GetTechTreeRequest();
    
    MessageHub.I.Send<GetTechTreeRequest, GetTechTreeResponse>(
        METHOD_GET, 
        request,
        response =>
        {
            if (response.code == 0)
            {
                // 更新本地缓存
                localCache = response.data.techtree;
                
                // 触发事件
                OnTechTreeDataReceived?.Invoke(localCache);
                onSuccess?.Invoke(localCache);
                
                Debug.Log($"[TechTreeService] Data received - Stage: {localCache.stage}, Progress: {localCache.progress}");
            }
            else
            {
                HandleError(response.code, response.msg, onError);
            }
        },
        10f // 超时时间
    );
}
```

### 升级科技节点（带队列控制）
```csharp
public void UpgradeTech(int nodeIndex, 
                        Action<UpgradeTechResponse> onSuccess = null,
                        Action<string> onError = null)
{
    // 检查是否已在升级中
    lock (nodeUpgradeStatus)
    {
        if (nodeUpgradeStatus.ContainsKey(nodeIndex) && 
            nodeUpgradeStatus[nodeIndex])
        {
            Debug.LogWarning($"[TechTreeService] Node {nodeIndex} is already upgrading");
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

### 队列处理协程
```csharp
private IEnumerator ProcessUpgradeQueue()
{
    isProcessingUpgrade = true;
    
    while (true)
    {
        UpgradeQueueItem currentItem = null;
        
        // 从队列取出请求
        lock (upgradeQueue)
        {
            if (upgradeQueue.Count == 0) break;
            currentItem = upgradeQueue.Dequeue();
        }
        
        if (currentItem != null)
        {
            // 执行升级请求
            bool requestCompleted = false;
            
            ExecuteUpgradeRequest(currentItem, 
                (response) => 
                {
                    requestCompleted = true;
                },
                (error) => 
                {
                    requestCompleted = true;
                });
            
            // 等待请求完成
            while (!requestCompleted)
            {
                yield return null;
            }
            
            // 请求间隔，防止过快
            yield return new WaitForSeconds(0.1f);
        }
    }
    
    isProcessingUpgrade = false;
}
```

### 执行单个升级请求
```csharp
private void ExecuteUpgradeRequest(UpgradeQueueItem item,
                                  Action<UpgradeTechResponse> onComplete,
                                  Action<string> onError)
{
    var request = new UpgradeTechRequest { type = item.NodeIndex };
    
    Debug.Log($"[TechTreeService] Executing upgrade for node {item.NodeIndex}");
    
    MessageHub.I.Send<UpgradeTechRequest, UpgradeTechResponse>(
        METHOD_UPGRADE,
        request,
        response =>
        {
            // 清除升级状态
            lock (nodeUpgradeStatus)
            {
                nodeUpgradeStatus[item.NodeIndex] = false;
            }
            
            if (response.code == 0)
            {
                var data = response.data;
                
                // 验证响应
                if (ValidateUpgradeResponse(item, data))
                {
                    // 更新缓存
                    UpdateLocalCache(data.stage, data.progress);
                    
                    // 触发事件
                    OnTechTreeUpgraded?.Invoke(data.stage, data.progress);
                    
                    // 回调成功
                    item.OnSuccess?.Invoke(data);
                    onComplete?.Invoke(data);
                }
                else
                {
                    string error = "升级响应验证失败";
                    item.OnError?.Invoke(error);
                    onError?.Invoke(error);
                }
            }
            else
            {
                HandleUpgradeError(response.code, response.msg, item.OnError);
                onError?.Invoke(response.msg);
            }
        },
        10f
    );
}
```

## 错误处理

### 错误码定义
```csharp
private void HandleError(int code, string msg, Action<string> onError)
{
    string errorMsg = msg;
    
    switch (code)
    {
        case 400:  // 参数错误
            errorMsg = "请求参数错误";
            break;
            
        case 401:  // 未授权
            errorMsg = "未登录或登录已过期";
            break;
            
        case 402:  // 资源不足
            if (msg.Contains("TechScroll"))
            {
                // 解析具体数量
                var match = Regex.Match(msg, @"need (\d+), have (\d+)");
                if (match.Success)
                {
                    errorMsg = $"科技卷轴不足，需要{match.Groups[1].Value}个，当前只有{match.Groups[2].Value}个";
                }
                else
                {
                    errorMsg = "科技卷轴不足";
                }
            }
            break;
            
        case 403:  // 已达上限
            errorMsg = "该技能已达到最大等级";
            break;
            
        case 404:  // 节点不存在
            errorMsg = "无效的技能节点";
            break;
            
        case 409:  // 并发冲突
            errorMsg = "操作过快，请稍后再试";
            break;
            
        case 500:  // 服务器错误
            errorMsg = "服务器错误，请稍后重试";
            break;
            
        default:
            errorMsg = $"未知错误: {msg}";
            break;
    }
    
    Debug.LogError($"[TechTreeService] Error {code}: {errorMsg}");
    onError?.Invoke(errorMsg);
}
```

### 重试机制
```csharp
private IEnumerator RetryRequest(Action request, int maxRetries = 3)
{
    int retryCount = 0;
    float retryDelay = 1f;
    
    while (retryCount < maxRetries)
    {
        bool success = false;
        
        // 执行请求
        request?.Invoke();
        
        // 等待结果
        yield return new WaitForSeconds(2f);
        
        if (success) break;
        
        retryCount++;
        
        // 指数退避
        yield return new WaitForSeconds(retryDelay);
        retryDelay *= 2f;
        
        Debug.Log($"[TechTreeService] Retry attempt {retryCount}/{maxRetries}");
    }
}
```

## 数据同步机制

### 本地缓存更新
```csharp
private void UpdateLocalCache(int stage, string progress)
{
    lock (cacheLock)
    {
        if (localCache == null)
        {
            localCache = new TechTreeData();
        }
        
        // 检测阶段变化
        bool stageChanged = localCache.stage != stage;
        
        localCache.stage = stage;
        localCache.progress = progress;
        localCache.updated_at = DateTimeOffset.Now.ToUnixTimeMilliseconds();
        
        // 重新计算完成度
        localCache.complete = CountCompletedNodes(progress);
        localCache.total = progress.Length;
        
        if (stageChanged)
        {
            Debug.Log($"[TechTreeService] Stage advanced to {stage}!");
        }
    }
}
```

### 数据验证
```csharp
private bool ValidateUpgradeResponse(UpgradeQueueItem item, UpgradeTechResponse response)
{
    // 验证进度长度
    if (string.IsNullOrEmpty(response.progress))
    {
        Debug.LogError("[TechTreeService] Invalid progress in response");
        return false;
    }
    
    // 验证节点索引
    if (item.NodeIndex >= response.progress.Length)
    {
        Debug.LogError($"[TechTreeService] Node index {item.NodeIndex} out of range");
        return false;
    }
    
    // 验证等级变化
    int newLevel = response.progress[item.NodeIndex] - '0';
    if (newLevel != item.ExpectedLevel)
    {
        Debug.LogWarning($"[TechTreeService] Unexpected level: expected {item.ExpectedLevel}, got {newLevel}");
    }
    
    return true;
}
```

## 网络优化策略

### 请求合并
```csharp
// 批量升级请求（未来优化）
public void BatchUpgrade(List<int> nodeIndices, 
                        Action<List<UpgradeTechResponse>> onSuccess)
{
    // 合并为单个请求
    var batchRequest = new BatchUpgradeRequest
    {
        nodes = nodeIndices
    };
    
    // 发送批量请求
    MessageHub.I.Send<BatchUpgradeRequest, BatchUpgradeResponse>(
        "techtree/batch_upgrade",
        batchRequest,
        response => { /* 处理批量响应 */ }
    );
}
```

### 增量同步
```csharp
// 仅同步变化的数据
public void SyncDelta(string lastProgress, Action<DeltaUpdate> onUpdate)
{
    var request = new DeltaSyncRequest
    {
        last_progress = lastProgress,
        last_update = localCache?.updated_at ?? 0
    };
    
    MessageHub.I.Send<DeltaSyncRequest, DeltaSyncResponse>(
        "techtree/sync_delta",
        request,
        response =>
        {
            if (response.has_changes)
            {
                ApplyDelta(response.delta);
                onUpdate?.Invoke(response.delta);
            }
        }
    );
}
```

### 断线重连处理
```csharp
// 监听网络状态
private void OnNetworkReconnected()
{
    Debug.Log("[TechTreeService] Network reconnected, syncing data...");
    
    // 重新获取最新数据
    GetTechTree(
        onSuccess: (data) =>
        {
            // 检查是否有未完成的升级
            ReconcilePendingUpgrades(data);
        },
        onError: (error) =>
        {
            Debug.LogError($"[TechTreeService] Failed to sync after reconnect: {error}");
        }
    );
}
```

## 性能监控

### 请求统计
```csharp
public class NetworkStats
{
    public int TotalRequests;
    public int SuccessfulRequests;
    public int FailedRequests;
    public float AverageResponseTime;
    public Dictionary<int, int> ErrorCodeCounts;
    
    public void LogRequest(float responseTime, int errorCode)
    {
        TotalRequests++;
        
        if (errorCode == 0)
        {
            SuccessfulRequests++;
        }
        else
        {
            FailedRequests++;
            ErrorCodeCounts[errorCode]++;
        }
        
        // 更新平均响应时间
        AverageResponseTime = (AverageResponseTime * (TotalRequests - 1) + responseTime) / TotalRequests;
    }
}
```

### 调试日志
```csharp
[Conditional("ENABLE_NETWORK_DEBUG")]
private void LogNetworkRequest(string method, object request)
{
    string json = JsonConvert.SerializeObject(request);
    Debug.Log($"[Network] >>> {method}\n{json}");
}

[Conditional("ENABLE_NETWORK_DEBUG")]
private void LogNetworkResponse(string method, object response, float time)
{
    string json = JsonConvert.SerializeObject(response);
    Debug.Log($"[Network] <<< {method} ({time:F2}ms)\n{json}");
}
```