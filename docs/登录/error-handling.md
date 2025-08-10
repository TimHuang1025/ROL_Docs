---
id: error-handling
title: 错误处理系统
sidebar_label: 错误处理系统
sidebar_position: 10
---

# 错误处理系统

## 概述

游戏的错误处理系统包括多层级的错误提示机制，从字段级验证到全局弹窗，确保用户能够及时了解操作结果。

## 错误提示层级

### 提示类型对比

| 类型 | 使用场景 | 持续时间 | 阻塞操作 |
|------|---------|---------|---------|
| **字段错误** | 输入验证 | 持续显示 | 否 |
| **Toast提示** | 轻量反馈 | 2秒 | 否 |
| **PopupManager** | 重要提示 | 需手动关闭 | 是 |
| **Loading遮罩** | 等待操作 | 操作完成 | 是 |

## 字段级错误提示

### ShowFieldError实现

```csharp title="AccountAuthController.cs - 字段错误提示"
// 单个Label错误提示
private void ShowFieldError(Label lbl, string msg, TextField focus = null)
{
    lbl.text = msg;
    lbl.style.color = Color.red;  // 红色
}

// 多个Label错误提示（用于同类多个提示框）
private void ShowFieldError(IEnumerable<Label> lbls, string msg, TextField focus = null)
{
    foreach (var l in lbls)
    {
        l.text = msg;
        l.style.color = Color.red;
    }
}

// 成功提示
private void ShowFieldOk(Label lbl, string msg, TextField focus = null)
{
    lbl.text = msg;
    lbl.style.color = okColor;  // 绿色
}

// 绿色定义
private static readonly Color okColor = new(0.32f, 0.65f, 0.53f, 1f);
```

### 使用示例

```csharp title="输入验证错误提示"
// 账号验证
if (!IsAccountValid(account))
{
    ShowFieldError(hinterror, "账号需≥5位，仅限英文或数字", accField);
    return false;
}

// 密码验证
if (password.Length < 6 || password.Length > 20)
{
    ShowFieldError(hinterrorpwd, "密码长度需6-20个字符", pwdField);
    return false;
}

// 邮箱验证
if (!IsEmailValid(email))
{
    ShowFieldError(hinterroremail, "请输入合法邮箱地址", emailField);
    return;
}

// 验证码验证
if (!Regex.IsMatch(code, @"^\d{6}$"))
{
    ShowFieldError(hinterroremailcode, "验证码需为 6 位数字", codeField);
    return;
}
```

### UI绑定

```csharp title="错误Label查找"
void Awake()
{
    var root = GetComponent<UIDocument>().rootVisualElement;
    
    /*── 错误 Label ──*/
    hinterror = root.Q<Label>("hinterror");          // 账号错误
    hinterrorpwd = root.Q<Label>("hinterrorpwd");    // 密码错误
    
    // 多个同类Label
    hinterroremail = root.Query<Label>(className: "hinterroremail").ToList();
    hinterroremailcode = root.Query<Label>(className: "hinterroremailcode").ToList();
}
```

## Toast轻量提示

### Toast实现

```csharp title="AccountAuthController.cs - Toast系统"
/*──────── UI：Toast ────────*/
private VisualElement toastPanel;
private Label toastText;
private Coroutine toastCO;

// Toast显示方法
private void Toast(string message, float duration = 2f)
{
    toastText.text = message;
    toastPanel.AddToClassList("show");
    
    if (toastCO != null) StopCoroutine(toastCO);
    toastCO = StartCoroutine(HideToastAfter(duration));
}

// 隐藏协程
private IEnumerator HideToastAfter(float duration)
{
    yield return new WaitForSeconds(duration);
    toastPanel.RemoveFromClassList("show");
}
```

### Toast样式

```css title="LogInScreenStyle.uss"
.toast {
    position: absolute;
    display: none;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.toast.show {
    display: flex;
    opacity: 1;
    transition: opacity 0.3s ease;
}
```

### 使用场景

```csharp
// 操作成功
Toast("注册并登录成功！");
Toast("验证成功，请设置新密码");

// 示例提示
Toast("（示例）本地校验通过，待接入 API");
```

## PopupManager全局弹窗

### PopupManager实现

```csharp title="PopupManager.cs"
public class PopupManager : MonoBehaviour
{
    static PopupManager inst;
    
    [SerializeField] VisualTreeAsset popupTpl;
    [SerializeField] UIDocument doc;
    
    VisualElement docRoot;
    VHSizer vhSizer;
    
    void Start()
    {
        inst = this;
        if (doc != null)
        {
            docRoot = doc.rootVisualElement;
            vhSizer = GetComponent<VHSizer>();
        }
    }
    
    // 静态调用方法
    public static void Show(string msg, float sec = 0f)
        => inst?.CreatePopup("提示", msg, sec);

    public static void Show(string title, string msg, float sec = 0f)
        => inst?.CreatePopup(title, msg, sec);
    
    /*────────── 生成弹窗 ──────────*/
    void CreatePopup(string title, string msg, float autoClose)
    {
        if (popupTpl == null || docRoot == null) return;

        // 1) CloneTree 并放进 Panel
        var root = popupTpl.CloneTree();
        docRoot.Add(root);
        root.BringToFront();

        // 2) 文案 + 关闭逻辑
        root.Q<Label>("Popuptitle")?.SetText(title);
        var txtLbl = root.Q<Label>("Popuptext");
        if (txtLbl != null)
            txtLbl.SetText(msg);
        txtLbl.style.unityTextAlign = TextAnchor.MiddleCenter;
        
        // 关闭按钮
        void Close() => root.RemoveFromHierarchy();
        root.Q<VisualElement>("BlackSpace")?.RegisterCallback<ClickEvent>(_ => Close());
        root.Q<VisualElement>("ClosePanel")?.RegisterCallback<ClickEvent>(_ => Close());
        var btn = root.Q<Button>("CloseBtn2");
        if (btn != null) btn.clicked += Close;

        // 自动关闭
        if (autoClose > 0f)
        {
#if UNITY_2022_2_OR_NEWER
            root.schedule.Execute(Close).StartingIn((long)(autoClose * 1000));
#else
            root.schedule.Execute(Close).ExecuteLater((long)(autoClose * 1000));
#endif
        }

        // 3) 弹窗加入后 ⇒ 再执行一次自适应
        vhSizer?.Apply();
    }
}
```

### 使用示例

```csharp title="PopupManager使用"
// 简单提示
PopupManager.Show("游客登录失败！\n" + msg);

// 带标题提示
PopupManager.Show("登录失败", msg);
PopupManager.Show("注册失败", msg);
PopupManager.Show("发送失败", msg);
PopupManager.Show("操作失败", msg);

// 输入提示
PopupManager.Show("提示", "密码需≥8位，并包含字母和数字");
PopupManager.Show("提示", "两次输入的密码不一致");

// 自动关闭（3秒）
PopupManager.Show("操作成功", "数据已保存", 3f);
```

## Loading状态管理

### LoadingPanelManager

```csharp title="LoadingPanelManager.cs"
public class LoadingPanelManager : MonoBehaviour
{
    public static LoadingPanelManager Instance { get; private set; }

    [SerializeField] Canvas loadingCanvas;

    void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);
        Hide();
    }
    
    public void Show() => loadingCanvas.enabled = true;
    public void Hide() => loadingCanvas.enabled = false;
}
```

### SpinController

```csharp title="局部Loading"
// 显示小转圈
SpinController.Instance.Show();

// 隐藏转圈
SpinController.Instance.Hide();
```

### 使用场景

```csharp
// 登录时显示全屏Loading
LoadingPanelManager.Instance.Show();

api.PasswordLogin(account, password,
    ok: _ => {
        // 成功不隐藏，直接跳转场景
        SceneManager.LoadScene("LoadingScene");
    },
    fail: _ => {
        // 失败时隐藏
        LoadingPanelManager.Instance.Hide();
        PopupManager.Show("登录失败", msg);
    }
);

// 验证码发送显示局部Loading
SpinController.Instance.Show();
api.GetEmailCode(email,
    ok: _ => SpinController.Instance.Hide(),
    fail: _ => SpinController.Instance.Hide()
);
```

## 错误码体系

### HTTP错误码

```csharp title="AuthAPI错误处理"
IEnumerator PostJson(string url, string json,
                     Action<string> ok, Action<string> fail)
{
    // ... 发送请求
    
    if (req.result != UnityWebRequest.Result.Success)
    {
        fail?.Invoke($"{req.responseCode} {req.error}");
        yield break;
    }

    var resp = JsonUtility.FromJson<ApiResp>(req.downloadHandler.text);
    if (resp.code == 0)
        ok?.Invoke(req.downloadHandler.text);
    else
        fail?.Invoke($"{resp.code} {resp.message}");
}
```


### 错误码判断

```csharp
// 特定错误码处理
if (msg.StartsWith("1"))  // 用户名相关
{
    lastCheckedName = nameTrying;
    lastNameIsUsable = false;
    ShowFieldError(hinterror, "用户名已存在", regAccField);
}
else
{
    // 其他错误
    PopupManager.Show("注册失败", msg);
}
```

## 输入验证

### 验证规则

```csharp title="输入验证方法"
// 账号验证
private static bool IsAccountValid(string acc) =>
    Regex.IsMatch(acc, @"^[A-Za-z0-9]{5,32}$");

// 密码强度验证
private static bool IsPasswordStrong(string pwd) =>
    Regex.IsMatch(pwd, @"^(?=.*\d)(?=.*[A-Za-z]).{8,}$");

// 密码匹配
private static bool IsPasswordMatch(string a, string b) => a == b;

// 邮箱验证
private bool IsEmailValid(string email)
{
    if (string.IsNullOrEmpty(email))
        return false;
    string pattern = @"^[^@\s]+@[^@\s]+\.[^@\s]+$";
    return Regex.IsMatch(email, pattern);
}
```

### 实时验证

```csharp title="验证码输入过滤"
// 验证码只允许数字
private void OnEmailCodeChanged(ChangeEvent<string> evt)
{
    var field = (TextField)evt.target;
    string pure = Regex.Replace(evt.newValue ?? "", @"[^\d]", "");
    
    if (pure != evt.newValue)
    {
        field.SetValueWithoutNotify(pure);
    }
}
```

## 按钮状态管理

### 防重复点击

```csharp title="按钮禁用"
// 点击后禁用
loginBtn?.SetEnabled(false);

api.PasswordLogin(account, password,
    ok: _ => loginBtn?.SetEnabled(true),
    fail: _ => loginBtn?.SetEnabled(true)
);
```

### 倒计时禁用

```csharp title="验证码按钮倒计时"
private IEnumerator ButtonCooldown(Button btn, int seconds)
{
    string originalText = btn.text;
    btn.SetEnabled(false);
    
    for (int i = seconds; i > 0; i--)
    {
        btn.text = $"{i}秒";
        yield return new WaitForSeconds(1f);
    }
    
    btn.text = originalText;
    btn.SetEnabled(true);
    cooldownCO = null;
}
```

## 注释的错误处理

项目中有些错误处理被注释了：

```csharp
// PopupManager被注释的地方
onFail: err =>
{
    LoadingPanelManager.Instance.Hide();
    //PopupManager.Show("连接战斗服失败", err);
}
```

可能原因：
1. 避免重复提示
2. 有其他错误处理机制
3. 调试期间临时注释

## 错误恢复

### 清空输入

```csharp title="错误后清空"
private void ClearAllInputs()
{
    var root = GetComponent<UIDocument>().rootVisualElement;
    root.Query<TextField>(className: "textinput")
        .ForEach(tf => tf.value = string.Empty);
    ResetErrorTexts();
}

private void ResetErrorTexts()
{
    hinterror.text = " ";
    hinterrorpwd.text = " ";
    foreach (var l in hinterroremail) l.text = " ";
    foreach (var l in hinterroremailcode) l.text = " ";
}
```

### 焦点管理

```csharp
private void Focus(TextField tf) =>
    tf?.schedule.Execute(() => tf.Focus()).ExecuteLater(0);
```

## 最佳实践

### 1. 分层处理

- 输入验证用字段错误
- 操作成功用Toast
- 重要错误用PopupManager
- 等待操作用Loading

### 2. 错误信息

- 明确说明问题
- 提供解决建议
- 避免技术术语

### 3. 用户体验

- 即时反馈
- 非阻塞提示优先
- 自动恢复焦点
- 清理错误状态

## 测试要点

### 错误场景测试

- 各种输入错误
- 网络异常
- 服务器错误
- 超时处理

### UI测试

- 错误提示显示正确
- Toast自动消失
- 弹窗可以关闭
- Loading正确显示/隐藏

### 恢复测试

- 错误后可重试
- 输入框正确清空
- 按钮状态恢复

## 常见问题

### Q: 为什么有些地方用ShowFieldError，有些用PopupManager？

**A:** ShowFieldError用于输入验证等轻量提示，PopupManager用于需要用户确认的重要信息。

### Q: Toast和PopupManager的区别？

**A:** Toast是非阻塞的轻量提示，自动消失；PopupManager是模态弹窗，需要手动关闭。

### Q: 为什么有些错误处理被注释了？

**A:** 可能是为了避免重复提示，或者调试时临时注释，需要根据实际需求决定是否启用。

## 相关文档

- [登录系统概述](./login-overview.md)
- [账号密码登录](./account-login.md)
- [网络通信](./network-communication.md)
- [玩家数据管理](./player-data.md)