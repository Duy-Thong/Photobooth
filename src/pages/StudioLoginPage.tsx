import { Navigate } from 'react-router-dom'
import { Button, Input, Form } from 'antd'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { useThemeClass } from '@/stores/themeStore'

export default function StudioLoginPage() {
  const { user, role, isAdminLoading, login, loginError, loggingIn } = useAdminAuth()
  const [form] = Form.useForm()
  const tc = useThemeClass()

  // Redirect when authenticated:
  //  - studio/superadmin → photobooth home
  //  - admin login is separate at /admin/login
  if (!isAdminLoading && user && role) return <Navigate to="/" replace />

  const handleFinish = ({ email, password }: { email: string; password: string }) => {
    login(email, password)
  }

  const inputStyle = {
    background: tc('#111', '#fff') === '#111' ? '#111' : '#fff',
    border: `1px solid ${tc('#2a2a2a', '#d9d9d9') === '#2a2a2a' ? '#2a2a2a' : '#d9d9d9'}`,
    color: tc('#e5e5e5', '#1a1a1a') === '#e5e5e5' ? '#e5e5e5' : '#1a1a1a',
  }

  return (
    <div className={`min-h-dvh flex items-center justify-center px-4 ${tc('bg-[#111]', 'bg-[#f5f5f5]')}`}>
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <h1 className={`text-2xl font-bold ${tc('text-white', 'text-black')}`} style={{ letterSpacing: '-0.03em' }}>Sổ Media</h1>
          <p className={`text-[10px] uppercase tracking-widest mt-1 ${tc('text-[#555]', 'text-[#999]')}`}>Photobooth Studio</p>
        </div>

        <div className={`rounded-2xl p-6 border ${tc('bg-[#0a0a0a] border-[#2a2a2a]', 'bg-white border-[#d9d9d9]')}`}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            autoComplete="off"
          >
            <Form.Item
              name="email"
              label={<span className={`text-sm ${tc('text-[#aaa]', 'text-[#666]')}`}>Email studio</span>}
              rules={[{ required: true, message: 'Nhập email' }, { type: 'email', message: 'Email không hợp lệ' }]}
            >
              <Input
                size="large"
                placeholder="studio@example.com"
                style={inputStyle}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span className={`text-sm ${tc('text-[#aaa]', 'text-[#666]')}`}>Mật khẩu</span>}
              rules={[{ required: true, message: 'Nhập mật khẩu' }]}
            >
              <Input.Password
                size="large"
                placeholder="••••••••"
                style={inputStyle}
              />
            </Form.Item>

            {loginError && (
              <p className="text-red-400 text-sm mb-4 text-center">{loginError}</p>
            )}

            <Button
              block
              size="large"
              htmlType="submit"
              loading={loggingIn}
              style={{
                background: tc('#fff', '#000') === '#fff' ? '#fff' : '#000',
                color: tc('#000', '#fff') === '#000' ? '#000' : '#fff',
                border: 'none',
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
