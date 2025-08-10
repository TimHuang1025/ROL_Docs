---
id: ui-implementation
title: UI实现细节
sidebar_label: UI实现细节
sidebar_position: 11
---

# UI实现细节

## 概述

登录界面采用Unity的UI Toolkit技术实现，通过UXML定义布局，USS控制样式，C#脚本处理逻辑。

## UI Toolkit架构

### 文件组织

| 文件类型 | 作用 | 位置 |
|---------|------|------|
| **UXML** | 界面布局 | `LogInScreenVisualTree.uxml` |
| **USS** | 样式表 | `LogInScreenStyle.uss` |
| **C#** | 逻辑控制 | `LogInScreen.cs` |
| **Assets** | 图片资源 | `Assets/UI/LoginPage/` |

### 技术优势

- **性能提升**: 相比UGUI提升30%
- **样式统一**: USS集中管理样式
- **布局灵活**: Flexbox布局系统
- **开发效率**: 可视化编辑器

## 页面结构

### 顶层布局

```xml title="LogInScreenVisualTree.uxml - 主结构"
<ui:UXML>
    <ui:VisualElement name="LogInScreen">
        <!-- 封面页 -->
        <ui:VisualElement name="CoverPanel">
            <ui:Button name="EnterButton"/>
        </ui:VisualElement>
        
        <!-- 页面容器 -->
        <ui:VisualElement name="PagesRoot">
            <!-- 邮箱登录页 -->
            <ui:VisualElement name="EmailPageContainer">
                <!-- 邮箱登录内容 -->
            </ui:VisualElement>
            
            <!-- 账号登录页 -->
            <ui:VisualElement name="AccountPageContainer">
                <ui:VisualElement name="AccountPagePanel">
                    <!-- 登录面板 -->
                    <ui:VisualElement name="AccountLoginPanel"/>
                    <!-- 注册面板 -->
                    <ui:VisualElement name="RegisterPanel"/>
                    <!-- 改密面板 -->
                    <ui:VisualElement name="AccountChangePwPanel"/>
                </ui:VisualElement>
            </ui:VisualElement>
        </ui:VisualElement>
        
        <!-- Toast提示 -->
        <ui:VisualElement name="ToastPanel" class="toast"/>
    </ui:VisualElement>
</ui:UXML>
```

### 页面切换逻辑

```csharp title="LogInScreen.cs - 页面管理"
public class LoginUIManager : MonoBehaviour
{
    // 页面导航栈
    private Stack<Action> navStack = new Stack<Action>();
    
    // 页面元素
    VisualElement pagesRoot;
    VisualElement emailPage;
    VisualElement accountPage;
    VisualElement loginPanel;
    VisualElement registerPanel;
    
    /* ───────── 页面切换 ───────── */
    private void ShowEmail()
    {
        navStack.Push(ShowLogin);
        pagesRoot.Show();
        emailPage.Show();
        accountPage.Hide();
    }

    private void ShowAccount()
    {
        pagesRoot.Show();
        accountPage.Show();
        emailPage.Hide();
        ShowLogin();
    }
    
    private void ShowLogin()
    {
        HideAccSubPanel();
        accountPagePanel.Show();
        loginPanel.Show();
    }
    
    private void ShowRegister()
    {
        navStack.Push(ShowLogin);
        HideAccSubPanel();
        registerPanel.Show();
    }
    
    /* ───────── 返回处理 ───────── */
    private void GoBack()
    {
        if (navStack.Count > 0)
            navStack.Pop()?.Invoke();
        else
            ShowLogin();
    }
}
```

## 输入组件

### TextField配置

```xml title="输入框UXML"
<!-- 账号输入 -->
<ui:TextField 
    placeholder-text="输入账号" 
    name="account-input" 
    class="textinput"
    max-length="20"/>

<!-- 密码输入 -->
<ui:TextField 
    placeholder-text="输入密码" 
    password="true"
    name="pwd-input" 
    class="textinput"
    max-length="20"/>

<!-- 邮箱输入 -->
<ui:TextField 
    placeholder-text="输入邮箱" 
    name="RegEmail" 
    class="textinput email-input"/>

<!-- 验证码输入 -->
<ui:TextField 
    placeholder-text="输入验证码" 
    name="RegCode" 
    class="textinput verifycode-input"
    max-length="6"/>
```

### 输入限制

```csharp title="输入控制"
// 验证码限制6位数字
root.Query<TextField>(className: "verifycode-input").ForEach(tf =>
{
    tf.maxLength = 6;
    tf.RegisterValueChangedCallback(OnEmailCodeChanged);
});

// 数字过滤
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

## 按钮系统

### 按钮类型

```xml title="各种按钮"
<!-- 登录按钮 -->
<ui:Button text="登录" name="LoginBtn" class="brownbutton"/>

<!-- 注册按钮 -->
<ui:Button text="注册" name="RegisterBtn" class="brownbutton"/>

<!-- 游客按钮 -->
<ui:Button name="GuestLogo" class="buttons border visitorbtn"/>

<!-- Google按钮 -->
<ui:Button name="GoogleBtn" class="googlebtn"/>

<!-- Apple按钮 -->
<ui:Button name="AppleBtn" class="applebtn"/>

<!-- 返回按钮 -->
<ui:Button name="ReturnButton" class="return-btn"/>

<!-- 获取验证码按钮 -->
<ui:Button text="获取验证码" name="RegSendCodeBtn" class="getemailcode"/>
```

### 按钮绑定

```csharp title="按钮事件绑定"
void Awake()
{
    var root = GetComponent<UIDocument>().rootVisualElement;
    
    // 单个按钮绑定
    loginBtn = root.Q<Button>("LoginBtn");
    if (loginBtn != null)
        loginBtn.clicked += () => OnClickLogin();
    
    // 批量绑定（同类按钮）
    root.Query<Button>(className: "visitorbtn")
        .ForEach(b => b.clicked += visitorApi.SendVisitorPlay);
    
    // 返回按钮批量绑定
    root.Query<Button>(className: "return-btn")
        .ForEach(b => b.clicked += ClearAllInputs);
}
```

## 样式系统

### USS样式定义

```css title="LogInScreenStyle.uss"
/* 输入框样式 */
.bar {
    background-image: url("输入账号框.png");
    border-radius: 10px;
    align-self: center;
    width: 100%;
    height: 45%;
}

/* 文字样式 */
.title {
    -unity-font-definition: url("中文font_dingliesongketi.ttf");
    font-size: 45px;
    color: rgb(251, 231, 178);
}

/* 按钮样式 */
.brownbutton {
    background-image: url("登录按钮.png");
    background-size: 45% 100%;
    -unity-background-scale-mode: scale-to-fit;
}

/* Toast样式 */
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

/* 错误提示 */
.hint {
    font-size: 25px;
    color: rgb(180, 35, 35);
    height: 3%;
    -unity-text-align: middle-center;
}
```

### 动态样式

```csharp title="动态修改样式"
// 添加/移除类
field.AddToClassList("error");
field.RemoveFromClassList("error");

// 直接修改样式
label.style.color = Color.red;
label.style.display = DisplayStyle.None;

// Toast动画
toastPanel.AddToClassList("show");
toastPanel.RemoveFromClassList("show");
```

## 元素查找

### Query系统

```csharp title="元素查找方法"
// 通过name查找单个元素
var loginBtn = root.Q<Button>("LoginBtn");
var hinterror = root.Q<Label>("hinterror");

// 通过class查找多个元素
var btns = root.Query<Button>(className: "visitorbtn").ToList();

// 查找并遍历
root.Query<TextField>(className: "textinput")
    .ForEach(tf => tf.value = string.Empty);

// 组合查找
var panel = root.Q<VisualElement>("AccountPageContainer")
                .Q<VisualElement>("AccountLoginPanel");
```

## 显示/隐藏控制

### 扩展方法

```csharp title="显示隐藏扩展"
static class VisualElementEx
{
    public static void Show(this VisualElement ve) 
        => ve.style.display = DisplayStyle.Flex;
        
    public static void Hide(this VisualElement ve) 
        => ve.style.display = DisplayStyle.None;
}

// 使用
loginPanel.Show();
registerPanel.Hide();
```

### 条件显示

```csharp title="平台相关显示"
// Apple登录按钮在不支持的平台隐藏
if (appleAuthManager == null)
{
    containers.ForEach(c => c.style.display = DisplayStyle.None);
    enabled = false;
}
```

## 动画效果

### 进入动画

```csharp title="LogInScreen.cs - 进入动画"
private IEnumerator EnterSequence()
{
    // 淡入效果
    float duration = 0.5f;
    float elapsed = 0f;
    
    while (elapsed < duration)
    {
        elapsed += Time.deltaTime;
        float t = elapsed / duration;
        
        // 修改透明度
        pagesRoot.style.opacity = t;
        
        yield return null;
    }
    
    pagesRoot.style.opacity = 1f;
}
```

### Toast动画

```css title="CSS过渡动画"
.toast {
    transition: opacity 0.3s ease;
}
```

## 资源管理

### 图片资源

```css title="背景图片使用"
.bar {
    background-image: url("project://database/Assets/Assets/UI/LoginPage/输入账号框.png");
}

.brownbutton {
    background-image: url("project://database/Assets/Assets/UI/LoginPage/登录按钮.png");
}
```

### 字体资源

```css
.title {
    -unity-font-definition: url("project://database/Assets/Assets/UI/中文font_dingliesongketi.ttf");
}
```

## 响应式布局

### Flexbox布局

```xml title="Flex布局示例"
<ui:VisualElement style="
    flex-direction: row;
    justify-content: space-around;
    align-items: center;
    flex-grow: 1;">
    <!-- 子元素自动排列 -->
</ui:VisualElement>
```

### 百分比布局

```csharp
// 宽高百分比
element.style.width = Length.Percent(100);
element.style.height = Length.Percent(50);

// 绝对定位
popup.style.position = Position.Absolute;
popup.style.left = 0;
popup.style.top = 0;
popup.style.right = 0;
popup.style.bottom = 0;
```

## 性能优化

### 元素复用

```csharp
// 缓存查找结果
private List<Label> hinterroremail;

void Awake()
{
    // 一次查找，多次使用
    hinterroremail = root.Query<Label>(className: "hinterroremail").ToList();
}
```

### 延迟加载

```csharp
// 非首屏元素延迟创建
if (registerPanel == null)
{
    registerPanel = CreateRegisterPanel();
}
```

## 调试技巧

### Debug输出

```csharp
// 检查元素是否找到
Debug.Log($"LoginBtn found: {loginBtn != null}");

// 输出元素数量
Debug.Log($"Found {btns.Count} visitor buttons");

// 检查样式
Debug.Log($"Display: {element.style.display}");
```

### UI Debugger

使用Unity的UI Toolkit Debugger：
- Window > UI Toolkit > Debugger
- 可以实时查看元素树
- 修改样式并实时预览

## 注意事项

### 1. 元素查找时机

必须在Awake或Start后查找元素，太早会找不到。

### 2. 样式优先级

内联样式 > USS类样式 > USS元素样式

### 3. 事件冒泡

UI Toolkit使用事件冒泡机制，注意事件传播。

## 常见问题

### Q: 为什么用UI Toolkit而不是UGUI？

**A:** UI Toolkit性能更好，样式管理更方便，支持数据绑定。

### Q: 如何调试找不到元素的问题？

**A:** 使用UI Toolkit Debugger查看元素树，确认name和class正确。

### Q: 样式不生效怎么办？

**A:** 检查USS文件是否正确引用，样式选择器是否正确，优先级是否被覆盖。

