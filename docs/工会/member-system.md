# 成员系统与权限

## 系统概述

工会成员系统提供了完整的成员管理、职位分配、权限控制功能。系统采用6级职位体系，每个职位拥有不同的权限等级。

## 职位体系

### 1. 职位等级

| 职位代码 | 显示名称 | 等级 | 人数限制 | 说明 |
|----------|----------|------|----------|------|
| **r6/leader** | 盟主 | 6 | 1人 | 最高权限 |
| **r5/coleader** | 副盟主 | 5 | 1人 | 副手权限 |
| **r4** | 内阁精英 | 4 | 8人 | 管理权限 |
| **r3** | 内阁成员 | 3 | 无限制 | 精英成员 |
| **r2** | 将军 | 2 | 无限制 | 普通成员 |
| **r1** | 士兵 | 1 | 无限制 | 新成员 |

### 2. 职位权限对照表

| 功能 | 盟主 | 副盟主 | R4 | R3 | R2 | R1 |
|------|------|--------|-----|-----|-----|-----|
| 修改工会设置 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 修改工会公告 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 审批申请 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 邀请成员 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 踢出成员 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 调整职位 | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ |
| 转让工会 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 解散工会 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 升级科技 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 发起集结 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

*副盟主不能调整盟主和副盟主的职位

## 数据结构

### 1. PlayerInfo - 玩家信息

```csharp
// 文件：Assets/Scripts/Network/Core/Service/PlayerInfoService.cs
[Serializable]
public class PlayerInfo
{
    // 基础信息
    public string cid;              // 玩家ID
    public string nickname;         // 昵称
    public string avatar;           // 头像
    public long total_power;        // 总战力
    
    // 工会信息
    public string union;            // 工会ID
    public string union_position;   // 职位代码 (r1-r6/leader/coleader)
    
    // 权限判断属性
    public bool HasUnion => !string.IsNullOrEmpty(union);
    public bool IsUnionLeader => union_position == "r6" || union_position == "leader";
    public bool IsUnionCoLeader => union_position == "r5" || union_position == "coleader";
    public bool IsUnionOfficer => union_position == "r4" || union_position == "r5" || 
                                  union_position == "r6" || union_position == "leader" || 
                                  union_position == "coleader";
}
```

### 2. UnionMemberInfo - 成员列表

```csharp
// 文件：Assets/Scripts/Network/Core/Service/UnionService.cs
[Serializable]
public class UnionMemberInfo
{
    public string leader;              // 盟主CID
    public string coleader;            // 副盟主CID
    public List<string> r4;            // R4成员CID列表（最多8人）
    public List<string> r3;            // R3成员CID列表
    public List<string> r2;            // R2成员CID列表
    public List<string> r1;            // R1成员CID列表
    public DateTime lastUpdateTime;    // 最后更新时间
}
```

## 权限判断

### 1. 基础权限判断

```csharp
// 文件：Assets/Scripts/Network/Core/Service/PlayerInfoService.cs
public bool IsUnionLeader => union_position == "r6" || union_position == "leader";
public bool IsUnionCoLeader => union_position == "r5" || union_position == "coleader";
public bool IsUnionOfficer => union_position == "r4" || IsUnionCoLeader || IsUnionLeader;
```

### 2. 权限更新

```csharp
// 文件：Assets/Scripts/UI/Clan/ClanMemberController.cs
private void UpdatePermissions()
{
    var myInfo = PlayerInfoService.I?.GetMyInfo();
    if (myInfo == null || !myInfo.HasUnion)
    {
        hasOfficerPermission = false;
        hasCoLeaderPermission = false;
        hasLeaderPermission = false;
        return;
    }

    // 根据职位设置权限
    hasOfficerPermission = myInfo.IsUnionOfficer;      // R4及以上
    hasCoLeaderPermission = myInfo.IsUnionCoLeader || myInfo.IsUnionLeader;  // R5及以上
    hasLeaderPermission = myInfo.IsUnionLeader;        // 只有R6
}
```

### 3. 管理权限判断

```csharp
// 文件：Assets/Scripts/UI/Clan/PlayerDetailPopupController.cs
// 判断是否可以管理目标玩家
private bool CanManagePlayer(string targetPosition)
{
    var myInfo = PlayerInfoService.I?.GetMyInfo();
    if (myInfo == null) return false;
    
    int myLevel = GetPositionLevel(myInfo.union_position);
    int targetLevel = GetPositionLevel(targetPosition);
    
    // 只能管理比自己职位低的成员
    return myLevel > targetLevel;
}

// 文件：Assets/Scripts/UI/Clan/PlayerDetailPopupController.cs
// 获取职位等级
private int GetPositionLevel(string position)
{
    switch (position)
    {
        case "r6":
        case "leader": return 6;
        case "r5":
        case "coleader": return 5;
        case "r4": return 4;
        case "r3": return 3;
        case "r2": return 2;
        case "r1": return 1;
        default: return 0;
    }
}
```

## 成员列表获取

### 1. 获取成员信息

```csharp
// 文件：Assets/Scripts/UI/Clan/ClanMemberController.cs
// 获取成员列表（支持增量更新）
UnionService.I.GetUnionMemberInfo(
    unionId: currentUnionId,
    cachedData: currentMemberInfo,  // 传递缓存数据
    onSuccess: (memberInfo) =>
    {
        currentMemberInfo = memberInfo;
        
        // 获取所有成员CID
        var allCids = new List<string>();
        if (!string.IsNullOrEmpty(memberInfo.leader)) 
            allCids.Add(memberInfo.leader);
        if (!string.IsNullOrEmpty(memberInfo.coleader)) 
            allCids.Add(memberInfo.coleader);
        allCids.AddRange(memberInfo.r4 ?? new List<string>());
        allCids.AddRange(memberInfo.r3 ?? new List<string>());
        allCids.AddRange(memberInfo.r2 ?? new List<string>());
        allCids.AddRange(memberInfo.r1 ?? new List<string>());
        
        // 批量获取玩家详情
        GetPlayersInfo(allCids);
    }
);
```

### 2. 增量更新机制

```csharp
// 文件：Assets/Scripts/Network/Core/Service/UnionService.cs
// 增量更新实现
if (cachedData != null)
{
    request.my_data["leader"] = cachedData.leader;
    request.my_data["coleader"] = cachedData.coleader;
    request.my_data["r4"] = cachedData.r4;
    request.my_data["r3"] = cachedData.r3;
    request.my_data["r2"] = cachedData.r2;
    request.my_data["r1"] = cachedData.r1;
}

// 服务器只返回变化的数据
// 客户端合并新旧数据
```

## 成员显示

### 1. 职位分组显示

```csharp
// 文件：Assets/Scripts/UI/Clan/ClanMemberController.cs
private void DisplayMembers()
{
    // 按职位分组显示
    DisplayLeader(leaderInfo);
    DisplayCoLeader(coLeaderInfo);
    DisplaySection("r4", r4Members, "内阁精英");
    DisplaySection("r3", r3Members, "内阁成员");
    DisplaySection("r2", r2Members, "将军团");
    DisplaySection("r1", r1Members, "士兵团");
}
```

### 2. 职位文本转换

```csharp
// 文件：Assets/Scripts/UI/Clan/ClanMemberController.cs
private string GetPositionText(string position)
{
    switch (position.ToLower())
    {
        case "leader":
        case "r6": return "盟主";
        case "coleader":
        case "r5": return "副盟主";
        case "r4": return "内阁精英";
        case "r3": return "内阁成员";
        case "r2": return "将军";
        case "r1": return "士兵";
        default: return "成员";
    }
}
```

### 3. 成员卡片结构

```yaml
MemberCard:
  Avatar:           # 头像
  NameLabel:        # 昵称
  PositionLabel:    # 职位
  PowerLabel:       # 战力
  StatusIcon:       # 在线状态
  ManageBtn:        # 管理按钮（根据权限显示）
```

## 职位调整

### 1. 职位调整限制

```csharp
// 文件：Assets/Scripts/UI/Clan/PositionSelectionPopupController.cs
private void UpdateSelectablePositions(UnionMemberInfo memberInfo)
{
    var myInfo = PlayerInfoService.I?.GetMyInfo();
    
    if (myInfo.IsUnionLeader)
    {
        // 盟主可以任命所有职位
        EnablePosition("r1");
        EnablePosition("r2");
        EnablePosition("r3");
        
        // R4检查人数限制（最多8人）
        if (memberInfo.r4 == null || memberInfo.r4.Count < 8)
        {
            EnablePosition("r4");
        }
        else
        {
            DisablePosition("r4", "内阁职位已满");
        }
        
        // 副盟主检查是否已有
        if (string.IsNullOrEmpty(memberInfo.coleader))
        {
            EnablePosition("coleader");
        }
        else
        {
            DisablePosition("coleader", "副盟主职位已满");
        }
    }
    else if (myInfo.IsUnionCoLeader)
    {
        // 副盟主可以任命R1-R4，但不能任命副盟主
        EnablePosition("r1");
        EnablePosition("r2");
        EnablePosition("r3");
        
        if (memberInfo.r4 == null || memberInfo.r4.Count < 8)
        {
            EnablePosition("r4");
        }
        
        DisablePosition("coleader");
    }
}
```

### 2. 执行职位调整

```csharp
// 文件：Assets/Scripts/Network/Core/Service/UnionService.cs
UnionService.I.ChangeMemberPosition(
    targetCid: targetPlayerCid,
    newPosition: selectedPosition,
    onSuccess: () =>
    {
        PopupManager.Show("成功", "职位已调整");
        RefreshMemberList();
    },
    onError: (error) =>
    {
        PopupManager.Show("失败", error);
    }
);
```

## API接口

### 1. 获取成员信息

**路径**: `union/get_union_member_info`  
**方法**: POST

```json
{
    "union_id": "union_123",
    "my_data": {
        "leader": "cached_leader_cid",
        "coleader": "cached_coleader_cid",
        "r4": ["cid1", "cid2"],
        "r3": ["cid3", "cid4"],
        "r2": ["cid5"],
        "r1": ["cid6"]
    }
}
```

### 2. 调整成员职位

**路径**: `union/change_member_position`  
**方法**: POST

```json
{
    "target_cid": "player_123",
    "new_position": "r4"
}
```

## 权限变更广播

### 1. 职位变更事件

```csharp
// 文件：Assets/Scripts/Network/Core/Service/UnionBroadcastHandler.cs
public event Action<string, string> OnPositionChanged;  // oldPos, newPos

// 处理职位变更
private void OnPositionChangedBroadcast(string dataJson)
{
    var data = JsonConvert.DeserializeObject<Dictionary<string, object>>(dataJson);
    string oldPosition = data["old_position"].ToString();
    string newPosition = data["new_position"].ToString();
    
    OnPositionChanged?.Invoke(oldPosition, newPosition);
}
```

### 2. 权限更新流程

```csharp
// 文件：Assets/Scripts/UI/Clan/ClanMemberController.cs
private void OnPositionChanged(string oldPos, string newPos)
{
    // 1. 立即更新权限状态
    UpdatePermissions();
    
    // 2. 刷新成员列表
    RefreshMemberList();
    
    // 3. 更新申请角标显示（降职后可能看不到申请了）
    RefreshApplyCount();
    
    // 4. 更新按钮显示状态
    UpdateButtonVisibility();
}
```

## 成员管理操作

### 1. 踢出成员

```csharp
// 文件：Assets/Scripts/UI/Clan/PlayerDetailPopupController.cs
// 只有盟主和副盟主有权限
if (!hasCoLeaderPermission)
{
    PopupManager.Show("提示", "您没有权限执行此操作");
    return;
}

// 文件：Assets/Scripts/Network/Core/Service/UnionService.cs
// 执行踢出
UnionService.I.KickMember(
    targetCid: memberCid,
    onSuccess: () => {
        RefreshMemberList();
    }
);
```

### 2. 邀请成员

```csharp
// 文件：Assets/Scripts/UI/Clan/ClanMemberController.cs
// R4及以上可以邀请
if (!hasOfficerPermission)
{
    PopupManager.Show("提示", "您没有权限邀请成员");
    return;
}

// 文件：Assets/Scripts/Network/Core/Service/UnionService.cs
// 发送邀请
UnionService.I.SendUnionInvitation(
    targetCid: targetPlayerCid,
    onSuccess: () => {
        PopupManager.Show("成功", "邀请已发送");
    }
);
```

## 注意事项

### 1. 权限校验
- 前端权限判断仅用于UI显示
- 所有操作都需要后端二次验证
- 权限不足时友好提示

### 2. 数据同步
- 使用增量更新减少数据传输
- 职位变更通过广播实时通知
- 定期刷新避免数据过期

### 3. 用户体验
- 职位满员时禁用选项并提示
- 管理操作需要二次确认
- 实时显示在线状态

### 4. 性能优化
- 批量获取玩家信息
- 缓存成员数据
- 虚拟列