- 注入打开游戏后崩溃

**`注入打开游戏后崩溃` / `经多次测试大概率为中文系统用户名导致`**

> **按下 `Win` + `R` 输入 `CMD` 并按下 `回车` 查看是否中文路径**

![](https://pic1.imgdb.cn/item/6951ce69a0c391c56de5f1ed.png)

> **如果显示中文,修改为英文**

**`错误提示(225)`**

> **没关杀毒**


**`Banned:Account Sharing` / `账号共享`**

> **因账号被Lexis系统AI判定为共享或二手转售账号被封禁** **该封禁目前无法人工干预解除,请珍惜自己的账号,不要外借/转售**

- Location check failed

**`Location check failed,please contact support` / `账号位置检测失败`**

> **多数情况出现于异地登录/更换设备** **及时联系卖家并提交证明账号使用情况是否为本人所为**

- Failed to install:BK1:0Xc0000022

**`Failed to install:BK1:0Xc0000022`**

> **BK1错误代表打开 bootmgfw.efi 时出错**  
> **Lexis驱动因缺少权限而无法写入引导**

**解决方法**

> **打开终端管理员**

![](https://pic1.imgdb.cn/item/694b9ed826657af64c6cf732.png)

**在框内输入：**

```powershell
bcdboot C:\Windows /l zh-cn
```

**并按下回车,即可修复引导**