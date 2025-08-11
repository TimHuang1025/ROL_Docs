# 数据配置文档

## 配置文件结构

### techtree.json 主配置文件
```json
{
  // 阶段定义 (1-8阶段)
  "1": {
    "0": ["recruit_speed", 5, [100,200,500,1000,2000], [0.02,0.05,0.09,0.14,0.2]],
    "1": ["money_speed", 5, [100,200,500,1000,2000], [0.02,0.05,0.09,0.14,0.2]],
    // ... 更多节点
  },
  
  // 描述文本映射
  "description": {
    "recruit_speed": "提升募兵速度{x}%",
    "money_speed": "提升金币产量{x}%",
    // ... 所有技能描述
  },
  
  // 格式化配置
  "player_tech_bonus_format": {
    "percentage": ["recruit_speed", "money_speed", ...],
    "integer": ["army_cap_bonus", "rally_cap_bonus", ...]
  }
}
```

### 节点数据格式
每个科技节点配置为数组：
```javascript
[
  "属性类型",      // string: 加成类型标识
  最大等级,        // int: 可升级的最大等级
  [升级消耗],      // int[]: 各等级升级所需科技卷轴
  [属性加成]       // float[]: 各等级提供的加成值
]
```

## 数据结构详解

### TechProgressData (ScriptableObject)
```csharp
// 文件：Assets/Scripts/SkillTree/TechProgressData.cs
[CreateAssetMenu(fileName = "TechProgressData", menuName = "Game/Tech Progress Data")]
public sealed class TechProgressData : ScriptableObject
{
    [Header("引用 techtree.json")]
    public TextAsset techtreeJson;           // JSON配置文件引用
    
    [Header("总体信息")]
    public int CurrentStage = 1;             // 当前阶段 (1-8)
    public string Progress = "";             // 进度字符串 "0032020020"
    
    [Header("行布局")]
    public List<StageRowLayout> StageLayouts; // 各阶段节点UI布局
    
    [Header("玩家科技加成")]
    public BonusData Bonus;                  // 计算后的总加成
}
```

### 进度字符串格式
- **格式**：纯数字字符串，如 "0032020020"
- **含义**：第n个字符表示第n个节点的当前等级
- **范围**：每个字符为0-9，代表等级0-9
- **示例**：
  ```
  Progress = "0032020020"
  解析：
  节点0: 等级0 (未解锁)
  节点1: 等级0 (未解锁)
  节点2: 等级3
  节点3: 等级2
  节点4: 等级0 (未解锁)
  ...
  ```

### StageRowLayout 布局数据
```csharp
[Serializable]
public sealed class StageRowLayout
{
    public string StageKey;      // 阶段标识 "1","2"..."8"
    public List<int> Rows;        // 节点所在行 [0,1,3,2,1,4...]
}
```

布局系统说明：
- UI分为5行(0-4)
- 每个节点随机分配到某一行
- 首次生成后永久保存，保证UI稳定性

### BonusData 加成数据
```csharp
[Serializable]
public sealed class BonusData
{
    // 资源类加成
    public float recruit_speed;              // 募兵速度
    public float money_speed;                // 金币产量
    public float food_speed;                 // 粮食产量
    public float mining_speed;               // 采矿速度
    
    // 战斗类加成
    public float all_army_attack_bonus;      // 全军攻击力
    public float damage_taken_reduction;     // 受伤减免
    public float soldier_damage_bonus;       // 士兵伤害
    public float captain_damage_bonus;       // 将领伤害
    
    // 地形加成
    public float cavalry_flatland_damage_bonus;  // 骑兵平原伤害
    public float ranged_forest_damage_bonus;     // 弓兵森林伤害
    public float infantry_hill_damage_bonus;     // 步兵山地伤害
    
    // 攻城加成
    public float attack_clan_building_damage_bonus;  // 攻击联盟建筑
    public float attack_map_building_damage_bonus;   // 攻击地图建筑
    public float attack_player_camp_damage_bonus;    // 攻击玩家营地
    
    // 防守加成
    public float defend_clan_building_damage_bonus;  // 防守联盟建筑
    public float defend_map_building_damage_bonus;   // 防守地图建筑
    public float defend_camp_damage_bonus;           // 防守营地
    
    // 将领属性
    public float all_captain_attack_power_bonus;     // 将领攻击力
    public float all_captain_defense_power_bonus;    // 将领防御力
    public float all_captain_wit_bonus;              // 将领智力
    
    // 卡牌属性
    public float card_attack_bonus;                  // 卡牌攻击
    public float card_defense_bonus;                 // 卡牌防御
    public float card_wit_bonus;                     // 卡牌智力
    
    // 行军类
    public float army_speed_bonus;                   // 行军速度
    public float rally_speed_bonus;                  // 集结速度
    public float recall_speed_bonus;                 // 撤回速度
    
    // 容量类
    public float army_cap_bonus;                     // 部队容量
    public float rally_cap_bonus;                    // 集结容量
    public float camp_garrison_cap_bonus;            // 驻防容量
    public float camp_garrison_from_clam_cap_bonus;  // 联盟驻防容量
    
    // 其他
    public float rally_summon_time_reduction;        // 集结召唤时间减少
    public float food_consumption_reduction;         // 粮食消耗减少
    public float money_consumption_reduction;        // 金币消耗减少
    public float teleport_cost_reduction;            // 传送消耗减少
}
```

## 配置示例

### 完整的阶段配置
```json
{
  "1": {
    "0": ["recruit_speed", 5, [100,200,500,1000,2000], [0.02,0.05,0.09,0.14,0.2]],
    "1": ["money_speed", 5, [100,200,500,1000,2000], [0.02,0.05,0.09,0.14,0.2]],
    "2": ["food_speed", 5, [100,200,500,1000,2000], [0.02,0.05,0.09,0.14,0.2]],
    "3": ["mining_speed", 5, [100,200,500,1000,2000], [0.02,0.05,0.09,0.14,0.2]],
    "4": ["all_army_attack_bonus", 5, [150,300,600,1200,2400], [0.01,0.025,0.045,0.07,0.1]],
    "5": ["damage_taken_reduction", 5, [150,300,600,1200,2400], [0.01,0.025,0.045,0.07,0.1]],
    "6": ["soldier_damage_bonus", 5, [200,400,800,1600,3200], [0.015,0.035,0.06,0.09,0.125]],
    "7": ["captain_damage_bonus", 5, [200,400,800,1600,3200], [0.015,0.035,0.06,0.09,0.125]],
    "8": ["army_speed_bonus", 3, [500,1500,3000], [0.05,0.12,0.2]],
    "9": ["army_cap_bonus", 3, [500,1500,3000], [1000,2500,5000]]
  }
}
```

### 进阶条件配置
```csharp
// 在TechTreeService.cs中的判定逻辑
private bool CheckStageProgress(int stage, string progress)
{
    // 计算当前阶段完成度
    int completed = 0;
    int total = progress.Length;
    
    for (int i = 0; i < progress.Length; i++)
    {
        if (progress[i] > '0') completed++;
    }
    
    float completionRate = (float)completed / total;
    return completionRate >= 0.7f; // 70%完成度进入下一阶段
}
```

## 数据计算逻辑

### 加成计算流程
```csharp
// 文件：Assets/Scripts/SkillTree/TechTreeCalculator.cs
public static Dictionary<string, float> Calc(int currentStage, string progress)
{
    // 1. 初始化所有属性为0
    var result = AllStatKeys.ToDictionary(k => k, _ => 0f);
    
    // 2. 遍历所有已完成的阶段
    for (int stage = 1; stage <= currentStage; stage++)
    {
        bool isCurrentStage = stage == currentStage;
        
        // 3. 累加每个节点的加成
        foreach (var node in stageNodes)
        {
            int level = isCurrentStage ? 
                GetLevelFromProgress(progress, nodeIndex) : 
                node.MaxLevel; // 已完成阶段取最大等级
                
            if (level > 0)
            {
                result[node.StatName] += node.Values[level - 1];
            }
        }
    }
    
    return result;
}
```

### 格式化显示
```csharp
// 根据配置决定显示格式
private string FormatBonus(string type, float value)
{
    // 百分比类型
    if (percentageTypes.Contains(type))
    {
        return $"{(value * 100):F1}%";
    }
    // 整数类型
    else if (integerTypes.Contains(type))
    {
        return $"+{(int)value}";
    }
    // 默认浮点数
    else
    {
        return $"+{value:F2}";
    }
}
```

## 数据验证规则

### 配置验证
1. **等级数组长度**：costs和values数组长度必须等于maxLevel
2. **递增验证**：升级消耗必须递增
3. **属性名验证**：必须在AllStatKeys中定义

### 进度验证
1. **字符范围**：只能包含0-9字符
2. **长度匹配**：必须与当前阶段节点数匹配
3. **等级上限**：不能超过节点的maxLevel

### 示例验证代码
```csharp
private bool ValidateProgress(string progress, int stage)
{
    // 检查是否为纯数字
    if (!progress.All(char.IsDigit)) return false;
    
    // 检查长度
    var expectedLength = GetStageNodeCount(stage);
    if (progress.Length != expectedLength) return false;
    
    // 检查等级上限
    for (int i = 0; i < progress.Length; i++)
    {
        int level = progress[i] - '0';
        int maxLevel = GetNodeMaxLevel(stage, i);
        if (level > maxLevel) return false;
    }
    
    return true;
}
```

## 数据迁移与版本控制

### 版本升级策略
1. **新增节点**：在JSON末尾添加，不影响现有进度
2. **修改数值**：保持数组长度不变，仅调整数值
3. **删除节点**：标记为废弃，保留位置但不显示

### 数据备份
```csharp
// 自动备份机制
[MenuItem("Tools/TechTree/Backup Progress")]
private static void BackupProgress()
{
    var source = "Assets/Scripts/SkillTree/TechProgressData.asset";
    var backup = $"Assets/Backup/TechProgress_{DateTime.Now:yyyyMMdd_HHmmss}.asset";
    AssetDatabase.CopyAsset(source, backup);
}
```

## 调试工具

### Inspector工具
```csharp
#if UNITY_EDITOR
// 在TechProgressData中添加测试方法
[ContextMenu("测试计算加成")]
private void TestCalculateBonus()
{
    RecalculateBonus();
    Debug.Log($"当前阶段: {CurrentStage}");
    Debug.Log($"进度: {Progress}");
    Debug.Log($"募兵速度加成: {Bonus.recruit_speed * 100}%");
}

[ContextMenu("重置进度")]
private void ResetProgress()
{
    CurrentStage = 1;
    Progress = new string('0', 10);
    RecalculateBonus();
}
#endif
```

### 运行时调试
```csharp
// 控制台命令
[ConsoleCommand("techtree.setprogress")]
public static void SetProgress(string progress)
{
    var data = Resources.Load<TechProgressData>("TechProgressData");
    data.Progress = progress;
    data.RecalculateBonus();
    Debug.Log($"Progress set to: {progress}");
}
```