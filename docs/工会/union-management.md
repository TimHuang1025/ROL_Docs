# 工会管理功能

## 功能概述

工会管理系统提供了完整的工会设置、信息编辑、成员管理等功能。不同职位拥有不同的管理权限，确保工会运作有序。

## 权限体系

### 权限等级

| 职位 | 权限等级 | 可执行操作 |
|------|---------|------------|
| **盟主** | 最高 | 所有管理功能 + 转让/解散 |
| **副盟主** | 高 | 除转让/解散外的所有功能 |
| **R4官员** | 中 | 审批申请、邀请成员 |
| **R3/R2/R1** | 低 | 无管理权限 |

### 权限判断

```csharp
// 判断是否有管理权限
bool IsManager()
{
    var myInfo = PlayerInfoService.I?.GetMyInfo();
    return myInfo?.IsUnionLeader || myInfo?.IsUnionCoLeader;
}

// 判断是否有审批权限
bool CanApprove()
{
    var position = myInfo.union_position;
    return position == "r6" || position == "r5" || position == "r4";
}
```

## 工会设置管理

### 1. 可修改设置项

| 设置项 | 说明 | 值范围 |
|--------|------|--------|
| **join_type** | 加入方式 | open/apply/invite |
| **min_power** | 最低战力要求 | 0-9999999 |
| **auto_power** | 自动通过战力 | -1(禁用) 或 正整数 |

### 2. 设置界面

```yaml
SettingsPopup:
  JoinMode:
    - PublicModeBtn    # 公开加入按钮
    - ApplyModeBtn     # 申请加入按钮
  
  PowerRequirement:
    - PowerDecBtn      # 减少按钮
    - PowerValue       # 当前值显示
    - PowerIncBtn      # 增加按钮
  
  AutoAccept:
    - AutoDecBtn       # 减少按钮
    - AutoValue        # 当前值显示  
    - AutoIncBtn       # 增加按钮
  
  Actions:
    - ConfirmBtn       # 确认保存
    - CancelBtn        # 取消
```

### 3. 设置修改实现

```csharp
// 修改工会设置
public void ChangeUnionSetting(
    Dictionary<string, object> newSetting,
    Action<Dictionary<string, object>> onSuccess,
    Action<string> onError)
{
    // 验证：三个加入相关设置必须一起提供
    bool hasJoinType = newSetting.ContainsKey("join_type");
    bool hasMinPower = newSetting.ContainsKey("min_power");
    bool hasAutoPower = newSetting.ContainsKey("auto_power");
    
    if (hasJoinType && (!hasMinPower || !hasAutoPower))
    {
        onError?.Invoke("加入设置必须完整提供");
        return;
    }
    
    // 发送请求
    var request = new ChangeUnionSettingRequest
    {
        new_setting = newSetting
    };
    
    MessageHub.I.Request(METHOD_CHANGE_UNION_SETTING, request, response =>
    {
        // 处理响应...
    });
}
```

### 4. 战力调整逻辑

```csharp
// 战力值调整（1000为步进）
private void AdjustPowerValue(ref int value, bool increase)
{
    if (increase)
    {
        value = Mathf.Min(value + 1000, 9999999);
    }
    else
    {
        value = Mathf.Max(value - 1000, 0);
    }
}
```

## 工会信息编辑

### 1. 可编辑内容

| 内容 | 权限要求 | 限制 |
|------|---------|------|
| **公告/简介** | 盟主/副盟主 | 最多100字符 |
| **旗帜图案** | 盟主/副盟主 | 1-10号图案 |
| **图案颜色** | 盟主/副盟主 | HEX颜色值 |
| **背景颜色** | 盟主/副盟主 | HEX颜色值 |
| **主要语言** | 盟主/副盟主 | 预设语言列表 |

### 2. 公告编辑

```csharp
// 显示编辑面板
private void ShowEditNoticePanel()
{
    var editingPanel = rootElement.Q<VisualElement>("EditingPanel");
    var viewPanel = rootElement.Q<VisualElement>("ViewPanel");
    
    editingPanel.style.display = DisplayStyle.Flex;
    viewPanel.style.display = DisplayStyle.None;
    
    // 加载当前公告
    var textArea = editingPanel.Q<TextField>("NoticeInput");
    textArea.value = currentUnionInfo.introduction;
}

// 保存公告
private void SaveNotice(string newNotice)
{
    var setting = new Dictionary<string, object>
    {
        { "introduction", newNotice }
    };
    
    UnionService.I.ChangeUnionSetting(setting, 
        onSuccess: (changed) => {
            PopupManager.Show("成功", "公告已更新");
            RefreshDisplay();
        },
        onError: (error) => {
            PopupManager.Show("失败", error);
        }
    );
}
```

### 3. 旗帜编辑

```csharp
// 旗帜编辑界面
EditGuildPopup:
  BannerCustomization:
    - BannerPreview      # 实时预览
    - IconGrid:          # 图案选择网格
        - Icon1-10       # 10个可选图案
    - ColorPickers:
        - IconColorPicker   # 图案颜色
        - BgColorPicker     # 背景颜色

// 更新旗帜
private void UpdateBanner()
{
    var setting = new Dictionary<string, object>
    {
        { "banner_symbol", selectedIconIndex.ToString() },
        { "banner_symbol_color", ColorToHex(iconColor) },
        { "banner_bg_color", ColorToHex(bgColor) }
    };
    
    UnionService.I.ChangeUnionSetting(setting, ...);
}
```

## 成员管理

### 1. 审批申请

```csharp
// 获取申请列表
UnionService.I.GetUnionApplications(
    getMyApplications: false,
    getUnionApplications: true,  // 获取工会收到的申请
    onSuccess: (mySent, unionReceived) =>
    {
        // unionReceived: 申请者CID列表
        DisplayApplicationList(unionReceived);
    }
);

// 处理申请
private void HandleApplication(string applicantCid, bool accept)
{
    UnionService.I.AcceptApplication(
        applicantCid: applicantCid,
        accept: accept,
        onSuccess: () => {
            string action = accept ? "已通过" : "已拒绝";
            PopupManager.Show("成功", $"申请{action}");
            RefreshApplicationList();
        }
    );
}
```

### 2. 踢出成员

```csharp
// 踢出成员流程
private void KickMember(string targetCid)
{
    // 显示确认对话框
    PopupManager.ShowConfirm(
        $"确定要将 {memberName} 移出工会吗？",
        onYes: () => {
            UnionService.I.KickMember(
                targetCid: targetCid,
                onSuccess: () => {
                    PopupManager.Show("成功", "成员已移出");
                    RefreshMemberList();
                },
                onError: (error) => {
                    PopupManager.Show("失败", error);
                }
            );
        }
    );
}
```

### 3. 职位调整

```csharp
// 职位调整规则
private bool CanChangePosition(string currentPos, string newPos)
{
    var myPos = GetMyPosition();
    
    // 盟主可以调整所有人
    if (myPos == "r6") return true;
    
    // 副盟主不能调整盟主和副盟主
    if (myPos == "r5")
    {
        return currentPos != "r6" && newPos != "r6";
    }
    
    return false;
}

// 调整职位
private void ChangePosition(string targetCid, string newPosition)
{
    UnionService.I.ChangeMemberPosition(
        targetCid: targetCid,
        newPosition: newPosition,
        onSuccess: () => {
            RefreshMemberList();
        }
    );
}
```

### 4. 邀请玩家

```csharp
// 发送邀请
public void SendInvitation(string targetCid)
{
    UnionService.I.SendUnionInvitation(
        targetCid: targetCid,
        onSuccess: () => {
            PopupManager.Show("成功", "邀请已发送");
        },
        onError: (error) => {
            PopupManager.Show("失败", error);
        }
    );
}
```

## 转让盟主

### 1. 转让条件

- 只有**盟主**可以转让
- 只能转让给**副盟主**
- 需要5秒倒计时确认

### 转让说明

转让功能在 `PlayerDetailPopupController.cs` 中实现：
- 检查是否为副盟主（只能转让给副盟主）
- 显示转让确认弹窗
- 调用 `ChangeMemberPosition` 接口将目标设为 "leader"

### 3. 转让实现

```csharp
// TransferOwnershipConfirmController.cs - 实际的转让确认
TransferOwnershipConfirmController.Show(
    rootElement,
    currentPlayerInfo.nickname,
    onConfirm: () =>
    {
        // 执行转让
        UnionService.I.ChangeMemberPosition(
            currentPlayerInfo.cid, 
            "leader",
            onSuccess: () =>
            {
                PopupManager.Show("转让成功", "公会已成功转让");
                RefreshMemberList();
                PlayerInfoService.I.RefreshMyInfo();
                ClosePopup();
            },
            onError: (error) =>
            {
                PopupManager.Show("转让失败", error);
            }
        );
    }
);
```

## 解散工会

### 1. 解散条件

- 只有**盟主**可以解散
- 工会只剩**1人**时才能解散

### 2. 解散流程

```csharp
// 退出工会（盟主退出=解散）
public void DissolveUnion()
{
    // 检查是否只剩一人
    if (memberCount > 1)
    {
        PopupManager.Show("无法解散", "工会还有其他成员");
        return;
    }
    
    // 显示确认
    PopupManager.ShowConfirm(
        "确定要解散工会吗？此操作不可恢复！",
        onYes: () => {
            UnionService.I.QuitUnion(
                onSuccess: () => {
                    // 工会已解散
                    ReturnToNoUnionState();
                }
            );
        }
    );
}
```

## API接口

### 1. 修改设置

**路径**: `union/change_union_setting`  
**方法**: POST

```json
{
    "new_setting": {
        "join_type": "apply",
        "min_power": 10000,
        "auto_power": 50000
    }
}
```

### 2. 接受/拒绝申请

**路径**: `union/accept_union_application`  
**方法**: POST

```json
{
    "type": "accept",  // 或 "decline"
    "cid": "player_123"
}
```

### 3. 踢出成员

**路径**: `union/quit_union`  
**方法**: POST

```json
{
    "type": "kick",
    "cid": "target_player_cid"
}
```

### 4. 调整职位

**路径**: `union/change_member_position`  
**方法**: POST

```json
{
    "target_cid": "player_123",
    "new_position": "r4"
}
```

## 界面更新

### 1. 权限变化时更新

```csharp
// 监听权限变化
UnionBroadcastHandler.I.OnPositionChanged += (oldPos, newPos) =>
{
    // 更新所有管理按钮的显示状态
    UpdateManagementButtons();
    
    // 刷新可执行的操作
    RefreshAvailableActions();
};
```

### 2. 设置变化时更新

```csharp
// 设置修改成功后
private void OnSettingChanged(Dictionary<string, object> changed)
{
    // 更新本地缓存
    UpdateLocalCache(changed);
    
    // 刷新显示
    if (changed.ContainsKey("join_type"))
    {
        UpdateJoinTypeDisplay();
    }
    
    if (changed.ContainsKey("introduction"))
    {
        UpdateAnnouncementDisplay();
    }
}
```

## 注意事项

### 1. 权限校验
- 前端和后端双重权限校验
- 操作前检查最新权限状态
- 权限不足时友好提示

### 2. 数据同步
- 修改后立即更新本地缓存
- 广播通知其他在线成员
- 定期刷新避免数据过期

### 3. 用户体验
- 危险操作需要二次确认
- 转让盟主需要倒计时
- 操作结果及时反馈

### 4. 异常处理
- 网络异常时的重试机制
- 并发操作的冲突处理
- 数据不一致的修复策略

## 相关文档

- [成员系统与权限](member-system.md)
- [职位体系说明](member-positions.md)
- [工会设置管理](union-settings.md)
- [工会转让流程](union-transfer.md)