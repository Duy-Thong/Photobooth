import { Navigate } from 'react-router-dom'
import { Button, Input, Form } from 'antd'
import { useAdminAuth } from '@/hooks/useAdminAuth'

export default function AdminLoginPage() {
  const { user, login, loginError, loggingIn } = useAdminAuth()
  const [form] = Form.useForm()

  if (user) return <Navigate to="/admin" replace />

  const handleFinish = ({ email, password }: { email: string; password: string }) => {
    login(email, password)
  }

  return (
    <div className="min-h-dvh bg-[#111] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.03em' }}>Sổ Media</h1>
          <p className="text-[#555] text-[10px] uppercase tracking-widest mt-1">Admin Panel</p>
        </div>

        <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl p-6">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            autoComplete="off"
          >
            <Form.Item
              name="email"
              label={<span className="text-[#aaa] text-sm">Email</span>}
              rules={[{ required: true, message: 'Nhập email' }, { type: 'email', message: 'Email không hợp lệ' }]}
            >
              <Input
                size="large"
                placeholder="admin@example.com"
                style={{ background: '#111', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span className="text-[#aaa] text-sm">Mật khẩu</span>}
              rules={[{ required: true, message: 'Nhập mật khẩu' }]}
            >
              <Input.Password
                size="large"
                placeholder="••••••••"
                style={{ background: '#111', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
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
              style={{ background: '#fff', color: '#000', border: 'none', fontWeight: 600, height: 44 }}
            >
              Đăng nhập
            </Button>
          </Form>
        </div>
      </div>
    </div>
  )
}
