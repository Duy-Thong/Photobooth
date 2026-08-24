import { Navigate } from 'react-router-dom'
import { Button, Input, Form } from 'antd'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { useThemeClass } from '@/stores/themeStore'
import ThemeToggle from '@/components/photobooth/ThemeToggle'

export default function AdminLoginPage() {
  const { user, permissions, login, loginError, loggingIn } = useAdminAuth()
  const [form] = Form.useForm()
  const tc = useThemeClass()

  if (user && permissions) return <Navigate to="/admin" replace />

  const handleFinish = ({ email, password }: { email: string; password: string }) => {
    login(email, password)
  }

  return (
    <div className={`min-h-dvh flex items-center justify-center px-4 relative transition-colors duration-200 ${tc('bg-[#0a0a0a]', 'bg-[#f8fafc]')}`}>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <h1 className={`text-2xl font-bold ${tc('text-white', 'text-slate-900')}`} style={{ letterSpacing: '-0.03em' }}>Photobooth</h1>
          <p className={`text-[10px] uppercase tracking-widest font-semibold mt-1 ${tc('text-slate-500', 'text-slate-400')}`}>Admin Panel</p>
        </div>

        <div className={`rounded-2xl p-7 border shadow-sm ${tc('bg-[#141414] border-[#262626]', 'bg-white border-slate-200')}`}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            autoComplete="off"
          >
            <Form.Item
              name="email"
              label={<span className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>Email</span>}
              rules={[{ required: true, message: 'Nhập email' }, { type: 'email', message: 'Email không hợp lệ' }]}
            >
              <Input
                size="large"
                placeholder="admin@example.com"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span className={`text-xs font-semibold uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>Mật khẩu</span>}
              rules={[{ required: true, message: 'Nhập mật khẩu' }]}
            >
              <Input.Password
                size="large"
                placeholder="••••••••"
              />
            </Form.Item>

            {loginError && (
              <p className="text-red-500 text-xs mb-4 text-center font-medium">{loginError}</p>
            )}

            <Button
              type="primary"
              block
              size="large"
              htmlType="submit"
              loading={loggingIn}
              style={{
                fontWeight: 600,
                height: 44,
              }}
            >
              Đăng nhập
            </Button>
          </Form>
        </div>
      </div>
    </div>
  )
}
