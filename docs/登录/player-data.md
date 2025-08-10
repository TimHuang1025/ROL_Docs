---
id: player-data
title: 玩家数据管理
sidebar_label: 玩家数据管理
sidebar_position: 7
---

# 玩家数据管理

## 概述

PlayerData是游戏中管理玩家会话信息的核心单例类，负责存储登录后的用户信息、服务器连接信息，并支持本地持久化存储。

## PlayerData实现

### 完整代码

```csharp title="PlayerData.cs"
using UnityEngine;

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

    public void SetSession(
        string uid,
        string userToken,
        string cid,
        string characterToken,
        int serverId,
        string serverIpAddress,
        int serverPort,
        string username = null,
        string signature = null)
    {
        Debug.Log($"[PlayerData] SetSession 被调用:");
        Debug.Log($"[PlayerData] - uid: {uid}");
        Debug.Log($"[PlayerData] - cid: {cid}");
        Debug.Log($"[PlayerData] - characterToken: {characterToken}");
        Debug.Log($"[PlayerData] - signature: {signature}");
        
        this.uid = uid;
        this.userToken = userToken;
        this.cid = cid;
        this.characterToken = characterToken;
        this.serverId = serverId;
        this.serverIpAddress = serverIpAddress;
        this.serverPort = serverPort;
        if (username != null) this.username = username;
        if (signature != null) this.signature = signature;
        
        // 保存到 PlayerPrefs
        SaveToPrefs();
    }
    
    // 保存关键数据
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
    
    // 恢复数据
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
    
    // 清除保存的数据（登出时调用）
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
}
```

## 数据结构

### 存储的数据字段

| 字段 | 类型 | 说明 | 持久化 |
|------|------|------|--------|
| **uid** | string | 用户唯一ID | ✅ |
| **userToken** | string | 用户令牌 | ❌ |
| **username** | string | 用户名 | ❌ |
| **signature** | string | 签名信息 | ✅ |
| **cid** | string | 角色ID | ✅ |
| **characterToken** | string | 角色令牌 | ✅ |
| **serverId** | int | 服务器ID | ❌ |
| **serverIpAddress** | string | 服务器IP | ✅ |
| **serverPort** | int | 服务器端口 | ✅ |

### 数据来源

数据主要来自登录服务器的响应：

```json
{
    "uid": "user_123456",
    "user_token": "token_xxxxx",
    "cid": "character_789",
    "character_token": "char_token_xxx",
    "server_id": 1,
    "server_ip_address": "192.168.1.100",
    "server_port": 8000
}
```

## 使用场景

### 1. 登录成功后保存

所有登录方式都使用相同的保存逻辑：

```csharp title="统一的保存方法"
private void SaveSession(string json)
{
    var d = JsonUtility.FromJson<ServerResp>(json);
    PlayerData.I.SetSession(
        d.uid, 
        d.user_token, 
        d.cid, 
        d.character_token,
        d.server_id, 
        d.server_ip_address, 
        d.server_port
    );
    PlayerData.I.Dump();  // 调试输出
}
```

### 2. 在不同登录方式中的使用

#### 账号密码登录
```csharp title="AccountAuthController.cs"
api.PasswordLogin(account, password,
    ok: json =>
    {
        SaveSession(json);  // 保存会话
        BattleServerBridge.Connect(json, ...);
    }
);
```

#### 游客登录
```csharp title="VisitorLoginRequest.cs"
api.VisitorLogin(deviceId,
    onSuccess: loginJson =>
    {
        var s = JsonUtility.FromJson<ServerResp>(loginJson);
        PlayerData.I.SetSession(
            s.uid, s.user_token,
            s.cid, s.character_token,
            s.server_id, s.server_ip_address, s.server_port
        );
        PlayerData.I.Dump();
    }
);
```

#### 第三方登录
```csharp title="GoogleLoginRequest.cs / AppleLogin.cs"
private void SaveSession(string json)
{
    var d = JsonUtility.FromJson<ServerResp>(json);
    PlayerData.I.SetSession(
        d.uid, d.user_token, 
        d.cid, d.character_token,
        d.server_id, d.server_ip_address, d.server_port
    );
    PlayerData.I.Dump();
}
```

### 3. 获取JWT时使用

```csharp title="MessageHub.cs"
IEnumerator GetNewJWT(Action<bool> callback)
{
    // 检查PlayerData状态
    Debug.Log($"[Hub] 检查PlayerData状态:");
    Debug.Log($"[Hub] - uid: '{PlayerData.I.uid}'");
    Debug.Log($"[Hub] - cid: '{PlayerData.I.cid}'");
    Debug.Log($"[Hub] - characterToken: '{PlayerData.I.characterToken}'");
    
    // 如果数据为空，尝试从PlayerPrefs恢复
    if (string.IsNullOrEmpty(PlayerData.I.uid))
    {
        if (PlayerPrefs.HasKey("PlayerData_uid"))
        {
            PlayerData.I.uid = PlayerPrefs.GetString("PlayerData_uid");
            PlayerData.I.cid = PlayerPrefs.GetString("PlayerData_cid");
            PlayerData.I.characterToken = PlayerPrefs.GetString("PlayerData_characterToken");
            PlayerData.I.serverIpAddress = PlayerPrefs.GetString("PlayerData_serverIpAddress");
            PlayerData.I.serverPort = PlayerPrefs.GetInt("PlayerData_serverPort");
            
            Debug.Log("[Hub] 手动恢复PlayerData成功");
        }
    }
    
    var url = $"http://{PlayerData.I.serverIpAddress}:{PlayerData.I.serverPort}/api/user/GetJWT";
    // ...
}
```

### 4. 连接战斗服时使用

```csharp title="BattleServerConnector.cs"
private IEnumerator Workflow(LoginServResp info)
{
    // 使用PlayerData中的信息构建JWT请求
    var jwtUrl = $"http://{info.server_ip_address}:{info.server_port}/api/user/GetJWT";
    var jwtIn = JsonUtility.ToJson(new GetJwtInput {
        uid = info.uid, 
        cid = info.cid, 
        character_token = info.character_token 
    });
    
    // ...
}
```

## 持久化存储

### PlayerPrefs存储

系统使用Unity的PlayerPrefs进行本地持久化：

```csharp
void SaveToPrefs()
{
    PlayerPrefs.SetString("PlayerData_uid", uid);
    PlayerPrefs.SetString("PlayerData_cid", cid);
    PlayerPrefs.SetString("PlayerData_characterToken", characterToken);
    PlayerPrefs.SetString("PlayerData_serverIpAddress", serverIpAddress);
    PlayerPrefs.SetInt("PlayerData_serverPort", serverPort);
    PlayerPrefs.SetString("PlayerData_signature", signature);
    PlayerPrefs.Save();
}
```

### 存储位置

不同平台的PlayerPrefs存储位置：

| 平台 | 存储位置 |
|------|---------|
| **Windows** | 注册表 `HKCU\Software\[company]\[product]` |
| **macOS** | `~/Library/Preferences/[bundle id].plist` |
| **Linux** | `~/.prefs/[company]/[product]` |
| **Android** | SharedPreferences |
| **iOS** | NSUserDefaults |
| **WebGL** | IndexedDB |

### 自动恢复

游戏启动时自动恢复数据：

```csharp
void Awake()
{
    // ... 单例初始化
    
    // 启动时尝试恢复数据
    LoadFromPrefs();
}
```

## 登出处理

### 清除数据

```csharp title="PlayerData.cs"
public void ClearSession()
{
    // 清空内存数据
    uid = "";
    cid = "";
    characterToken = "";
    serverIpAddress = "";
    serverPort = 0;
    signature = "";
    
    // 清除本地存储
    PlayerPrefs.DeleteKey("PlayerData_uid");
    PlayerPrefs.DeleteKey("PlayerData_cid");
    PlayerPrefs.DeleteKey("PlayerData_characterToken");
    PlayerPrefs.DeleteKey("PlayerData_serverIpAddress");
    PlayerPrefs.DeleteKey("PlayerData_serverPort");
    PlayerPrefs.DeleteKey("PlayerData_signature");
    PlayerPrefs.Save();
    
    Debug.Log("[PlayerData] 已清除本地数据");
}
```

### LogoutHandler中的处理

```csharp title="LogoutHandler.cs"
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
}
```

## 调试功能

### Dump方法

用于调试输出所有数据：

```csharp
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

### 使用示例

```csharp
// 保存数据后立即输出
PlayerData.I.SetSession(...);
PlayerData.I.Dump();  // 查看保存的数据
```

## 其他服务的集成

### PlayerInfoService

```csharp title="PlayerInfoService.cs"
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
        // ...
    }
}
```

## 注意事项

### 1. 单例模式

PlayerData使用标准的Unity单例模式：

```csharp
if (I != null && I != this)
{
    Destroy(gameObject);
    return;
}
I = this;
DontDestroyOnLoad(gameObject);
```

### 2. 部分字段不持久化

注意`userToken`和`serverId`等字段不会持久化，每次登录都需要重新获取。

### 3. 手动恢复机制

MessageHub中有手动恢复机制，以防自动恢复失败：

```csharp
if (PlayerPrefs.HasKey("PlayerData_uid"))
{
    // 手动恢复数据
}
```

## 常见问题

### Q: 为什么有些字段不持久化？

**A:** `userToken`等敏感信息不应该持久化存储，每次登录重新获取更安全。

### Q: PlayerData在什么时候创建？

**A:** 通常在游戏启动时通过Prefab创建，或者在第一次使用时自动创建。

### Q: 如何确保数据安全？

**A:** PlayerPrefs的数据是明文存储的，敏感信息应该加密或不存储。

### Q: 清除数据后能自动登录吗？

**A:** 不能。清除数据后需要重新登录。

## 相关文档

- [登录系统概述](./login-overview.md)
- [网络通信](./network-communication.md)
- [错误处理](./error-handling.md)