# 数据持久化系统文档

## 概述

游戏的数据持久化系统使用Unity原生的PlayerPrefs和文件系统来存储数据。系统实现了会话管理、缓存机制和自动保存功能，所有数据均为明文存储。

## 持久化架构

### 存储方式

| 存储方式 | 使用场景 | 实际应用 |
|---------|---------|---------|
| **PlayerPrefs** | 小型配置数据 | 会话信息、用户信息、小型缓存 |
| **File System** | 大型数据 | 工会信息、玩家信息缓存 |
| **内存缓存** | 临时数据 | 运行时数据 |

## PlayerData - 会话管理

### 实际实现代码

```csharp
// PlayerData.cs - 实际代码
public class PlayerData : MonoBehaviour
{
    public static PlayerData I { get; private set; }
    
    [Header("账号 & 会话")]
    public string uid;
    public string userToken;
    public string username;
    public string signature;

    [Header("角色信息")]
    public string cid;
    public string characterToken;

    [Header("游戏服")]
    public int serverId;
    public string serverIpAddress;
    public int serverPort;

    void Awake()
    {
        if (I != null && I != this)
        {
            Destroy(gameObject);
            return;
        }
        I = this;
        DontDestroyOnLoad(gameObject);
        
        // 启动时尝试恢复数据
        LoadFromPrefs();
    }

    // 保存到PlayerPrefs（明文）
    void SaveToPrefs()
    {
        PlayerPrefs.SetString("PlayerData_uid", uid);
        PlayerPrefs.SetString("PlayerData_cid", cid);
        PlayerPrefs.SetString("PlayerData_characterToken", characterToken);
        PlayerPrefs.SetString("PlayerData_serverIpAddress", serverIpAddress);
        PlayerPrefs.SetInt("PlayerData_serverPort", serverPort);
        PlayerPrefs.SetString("PlayerData_signature", signature);
        PlayerPrefs.Save();
        
        Debug.Log("[PlayerData] 数据已保存到本地");
    }
    
    // 从PlayerPrefs恢复
    void LoadFromPrefs()
    {
        if (PlayerPrefs.HasKey("PlayerData_uid"))
        {
            uid = PlayerPrefs.GetString("PlayerData_uid");
            cid = PlayerPrefs.GetString("PlayerData_cid");
            characterToken = PlayerPrefs.GetString("PlayerData_characterToken");
            serverIpAddress = PlayerPrefs.GetString("PlayerData_serverIpAddress");
            serverPort = PlayerPrefs.GetInt("PlayerData_serverPort");
            signature = PlayerPrefs.GetString("PlayerData_signature");
            
            Debug.Log("[PlayerData] 从本地恢复数据成功");
            Dump();
        }
    }
    
    // 清除数据
    public void ClearSession()
    {
        uid = "";
        cid = "";
        characterToken = "";
        serverIpAddress = "";
        serverPort = 0;
        signature = "";
        
        PlayerPrefs.DeleteKey("PlayerData_uid");
        PlayerPrefs.DeleteKey("PlayerData_cid");
        PlayerPrefs.DeleteKey("PlayerData_characterToken");
        PlayerPrefs.DeleteKey("PlayerData_serverIpAddress");
        PlayerPrefs.DeleteKey("PlayerData_serverPort");
        PlayerPrefs.DeleteKey("PlayerData_signature");
        PlayerPrefs.Save();
        
        Debug.Log("[PlayerData] 已清除本地数据");
    }
}
```

## PlayerInfoService - 玩家信息缓存

### 实际的缓存实现

```csharp
// PlayerInfoService.cs - 实际代码
public class PlayerInfoService : MonoBehaviour
{
    private const float CACHE_EXPIRE_HOURS = 24f;
    private const string MY_INFO_KEY = "PlayerInfo_MyInfo";
    private const string CACHE_FILE_NAME = "player_info_cache.json";
    
    private PlayerInfo myInfo;
    private Dictionary<string, CachedPlayerInfo> playerInfoCache = new();
    
    [Serializable]
    private class CachedPlayerInfo
    {
        public PlayerInfo info;
        public DateTime cacheTime;
        
        public bool IsExpired => 
            (DateTime.Now - cacheTime).TotalHours > CACHE_EXPIRE_HOURS;
    }
    
    // 保存到文件（实际代码）
    private void SaveCache()
    {
        try
        {
            var cacheData = new CacheData
            {
                playerCache = playerInfoCache,
                version = 1
            };
            
            var json = JsonConvert.SerializeObject(cacheData);
            var path = GetCachePath();
            System.IO.File.WriteAllText(path, json);
            
            Debug.Log($"[PlayerInfoService] Cache saved: {playerInfoCache.Count} players");
        }
        catch (Exception e)
        {
            Debug.LogError($"[PlayerInfoService] Save cache failed: {e.Message}");
        }
    }
    
    // 从文件加载（实际代码）
    private void LoadCache()
    {
        try
        {
            var path = GetCachePath();
            if (System.IO.File.Exists(path))
            {
                var json = System.IO.File.ReadAllText(path);
                var cacheData = JsonConvert.DeserializeObject<CacheData>(json);
                
                if (cacheData != null && cacheData.version == 1)
                {
                    playerInfoCache = cacheData.playerCache ?? new();
                    
                    // 清理过期缓存
                    var expiredKeys = playerInfoCache
                        .Where(kvp => kvp.Value.IsExpired)
                        .Select(kvp => kvp.Key)
                        .ToList();
                        
                    foreach (var key in expiredKeys)
                    {
                        playerInfoCache.Remove(key);
                    }
                }
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"[PlayerInfoService] Load cache failed: {e.Message}");
        }
    }
    
    // 保存我的信息到PlayerPrefs（实际代码）
    private void SaveMyInfo()
    {
        try
        {
            if (myInfo != null)
            {
                var json = JsonConvert.SerializeObject(myInfo);
                PlayerPrefs.SetString(MY_INFO_KEY, json);
                PlayerPrefs.Save();
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"[PlayerInfoService] Save my info failed: {e.Message}");
        }
    }
    
    private string GetCachePath()
    {
        return System.IO.Path.Combine(Application.persistentDataPath, CACHE_FILE_NAME);
    }
}
```

## UnionService - 工会缓存管理

### UnionCacheManager实际实现

```csharp
// UnionService.cs中的UnionCacheManager - 实际代码
public class UnionCacheManager
{
    private const string UNION_LIST_KEY = "UnionService_List";
    private const string UNION_INFO_KEY = "UnionService_Info_";
    private const string CACHE_VERSION_KEY = "UnionService_Version";
    private const int CURRENT_VERSION = 1;
    
    // 混合存储：大数据用文件，小数据用PlayerPrefs（实际代码）
    public void SaveUnionInfo(Dictionary<string, UnionInfo> dict)
    {
        try
        {
            var json = JsonConvert.SerializeObject(dict);
            
            // 大于100KB的数据存文件
            if (json.Length > 100000)
            {
                SaveToFile(UNION_INFO_KEY, json);
            }
            else
            {
                PlayerPrefs.SetString(UNION_INFO_KEY, json);
            }
            
            PlayerPrefs.SetInt(CACHE_VERSION_KEY, CURRENT_VERSION);
            PlayerPrefs.Save();
        }
        catch (Exception e)
        {
            Debug.LogError($"[UnionCacheManager] Save failed: {e.Message}");
        }
    }
    
    // 文件操作（实际代码）
    private void SaveToFile(string key, string data)
    {
        try
        {
            var path = GetFilePath(key);
            System.IO.File.WriteAllText(path, data);
        }
        catch (Exception e)
        {
            Debug.LogError($"[UnionCacheManager] Save to file failed: {e.Message}");
        }
    }
    
    private string LoadFromFile(string key)
    {
        try
        {
            var path = GetFilePath(key);
            if (System.IO.File.Exists(path))
            {
                return System.IO.File.ReadAllText(path);
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"[UnionCacheManager] Load from file failed: {e.Message}");
        }
        return null;
    }
    
    private string GetFilePath(string key)
    {
        return System.IO.Path.Combine(Application.persistentDataPath, $"{key}.json");
    }
    
    // 版本控制（实际代码）
    public List<UnionListItem> LoadUnionList()
    {
        // 检查版本
        if (PlayerPrefs.GetInt(CACHE_VERSION_KEY, 0) != CURRENT_VERSION)
        {
            Debug.Log("[UnionCacheManager] Cache version mismatch, clearing cache");
            ClearCache();
            return new List<UnionListItem>();
        }
        
        var json = PlayerPrefs.GetString(UNION_LIST_KEY, "");
        if (!string.IsNullOrEmpty(json))
        {
            return JsonConvert.DeserializeObject<List<UnionListItem>>(json);
        }
        
        return new List<UnionListItem>();
    }
    
    public void ClearCache()
    {
        PlayerPrefs.DeleteKey(UNION_LIST_KEY);
        PlayerPrefs.DeleteKey(UNION_INFO_KEY);
        PlayerPrefs.DeleteKey(CACHE_VERSION_KEY);
        DeleteFile(UNION_LIST_KEY);
        DeleteFile(UNION_INFO_KEY);
        PlayerPrefs.Save();
    }
}
```

## 自动保存机制

### PlayerInfoService的自动保存（实际代码）

```csharp
// PlayerInfoService.cs - 实际的自动保存代码
void OnDestroy()
{
    SaveCache();
}

void OnApplicationPause(bool pauseStatus)
{
    if (pauseStatus)
    {
        SaveCache();
    }
}

void OnApplicationFocus(bool hasFocus)
{
    if (!hasFocus)
    {
        SaveCache();
    }
}
```

## 登出清理

### LogoutHandler的清理流程（实际代码）

```csharp
// LogoutHandler.cs - 实际代码
private static void ClearUserData()
{
    // 清理 PlayerData 单例
    if (PlayerData.I != null)
    {
        Debug.Log("[LogoutHandler] Cleaning PlayerData...");
        PlayerData.I.SetSession("", "", "", "", 0, "", 0);
        UnityEngine.Object.Destroy(PlayerData.I.gameObject);
    }
    
    // 清理所有 PlayerPrefs
    Debug.Log("[LogoutHandler] Clearing all PlayerPrefs...");
    PlayerPrefs.DeleteAll();
    PlayerPrefs.Save();
    
    // 清理缓存目录（如果有使用）
    if (System.IO.Directory.Exists(Application.persistentDataPath + "/cache"))
    {
        try
        {
            System.IO.Directory.Delete(Application.persistentDataPath + "/cache", true);
            Debug.Log("[LogoutHandler] Cache directory cleared");
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"[LogoutHandler] Failed to clear cache: {e.Message}");
        }
    }
}
```

### PlayerInfoService的登出处理（实际代码）

```csharp
// PlayerInfoService.cs - 实际代码
public static void UserLogout()
{
    Debug.Log("[PlayerInfoService] User logout, cleaning up...");
    
    if (I != null)
    {
        I.myInfo = null;
        I.playerInfoCache.Clear();
        I.IsInited = false;
        
        // 清理本地存储
        PlayerPrefs.DeleteKey(MY_INFO_KEY);
        try
        {
            var path = I.GetCachePath();
            if (System.IO.File.Exists(path))
            {
                System.IO.File.Delete(path);
            }
        }
        catch { }
    }
}
```

## 存储位置

### PlayerPrefs各平台位置

| 平台 | 实际存储位置 |
|------|-------------|
| **Windows** | 注册表 `HKCU\Software\[company]\[product]` |
| **macOS** | `~/Library/Preferences/[bundle id].plist` |
| **Linux** | `~/.prefs/[company]/[product]` |
| **Android** | `/data/data/[package]/shared_prefs/` |
| **iOS** | `NSUserDefaults` |
| **WebGL** | `IndexedDB` |

### Application.persistentDataPath各平台路径

| 平台 | 实际路径 |
|------|---------|
| **Windows** | `%userprofile%\AppData\LocalLow\[company]\[product]` |
| **macOS** | `~/Library/Application Support/[company]/[product]` |
| **Linux** | `~/.config/unity3d/[company]/[product]` |
| **Android** | `/storage/emulated/0/Android/data/[package]/files` |
| **iOS** | `/var/mobile/Containers/Data/Application/[guid]/Documents` |

## 数据安全性说明

### 当前状态

1. **所有数据均为明文存储**
   - PlayerPrefs直接存储字符串
   - 文件系统存储JSON格式
   - 没有任何加密措施

2. **敏感数据风险**
   - characterToken、signature等敏感信息明文保存
   - 任何能访问存储位置的程序都能读取

3. **建议改进**（但目前未实现）
   - 考虑对敏感数据加密
   - 使用Unity Keystore等安全存储方案
   - 服务器端验证防止本地数据篡改

## 性能考虑

### PlayerPrefs.Save()调用时机

```csharp
// 实际代码中的调用位置
PlayerPrefs.Save();  // 每次保存后立即调用

// 注意：频繁调用会影响性能，但项目中为了数据安全都是立即保存
```

### 文件IO处理

```csharp
// 实际使用同步IO（没有使用异步）
System.IO.File.WriteAllText(path, json);  // 同步写入
var json = System.IO.File.ReadAllText(path);  // 同步读取
```

## 注意事项

1. **数据未加密** - 所有持久化数据都是明文，注意安全风险
2. **PlayerPrefs限制** - 单个键值对建议不超过1MB
3. **文件系统权限** - 某些平台可能需要特殊权限
4. **WebGL限制** - IndexedDB可能被用户清理
5. **性能影响** - PlayerPrefs.Save()是同步操作，可能造成卡顿

## 调试信息

### PlayerData的Dump方法（实际代码）

```csharp
// PlayerData.cs - 实际代码
public void Dump()
{
    Debug.Log($"[PlayerData]\n" +
            $"uid={uid}\n" +
            $"userToken={userToken}\n" +
            $"username={username}\n" +
            $"cid={cid}\n" +
            $"characterToken={characterToken}\n" +
            $"serverId={serverId}\n" +
            $"server={serverIpAddress}:{serverPort}\n" +
            $"signature={signature}");
}
```

### PlayerInfoService的调试信息（实际代码）

```csharp
// PlayerInfoService.cs - 实际代码
public string GetDebugInfo()
{
    var sb = new System.Text.StringBuilder();
    sb.AppendLine("=== PlayerInfoService Debug Info ===");
    sb.AppendLine($"- Service Status: {(IsInited ? "Initialized" : "Not Initialized")}");
    sb.AppendLine($"- My Info: {(myInfo != null ? $"{myInfo.nickname} ({myInfo.cid})" : "null")}");
    sb.AppendLine($"- My Union: {(myInfo?.HasUnion ?? false ? $"{myInfo.union} - {myInfo.union_position}" : "No Union")}");
    sb.AppendLine($"- Cached Players: {playerInfoCache.Count}");
    sb.AppendLine($"- Cache Path: {GetCachePath()}");
    
    return sb.ToString();
}
```