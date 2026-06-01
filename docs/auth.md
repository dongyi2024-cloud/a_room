# 认证配置

## 开发阶段：邮箱 + 密码注册，无邮箱确认

当前开发和内测阶段暂时使用 Supabase Auth 的邮箱 + 密码注册/登录，不接入 Resend，不自行发送邮件。

Supabase Dashboard 设置：

1. 打开 Supabase Dashboard。
2. 进入 `Authentication`。
3. 进入 `Providers`。
4. 打开 `Email`。
5. 关闭 `Confirm Email`。

关闭后，用户使用邮箱和密码注册时，不需要点击确认邮件即可登录。

本地和 Vercel 环境变量：

```bash
NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION=false
```

该模式只用于开发和内测。它允许新用户跳过邮箱验证，因此不应作为正式生产配置。

## 正式上线前

正式上线前必须配置可靠的邮件服务：

- 配置 Resend Custom SMTP 或等价 SMTP 服务。
- 在 Supabase Dashboard 重新开启 `Confirm Email`。
- 将环境变量改为：

```bash
NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION=true
```

不要在前端暴露任何服务端密钥，不要把 service role key 写入客户端代码或提交到 Git。

## 忘记密码

忘记密码仍然依赖 Supabase 邮件发送能力。

开发阶段如果触发 Supabase 邮件频率限制，请稍后再试。正式环境必须配置 Custom SMTP，否则密码重置和邮箱验证邮件都不可靠。
