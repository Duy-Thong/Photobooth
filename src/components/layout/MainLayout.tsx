import { Outlet } from 'react-router-dom'
import { Layout } from 'antd'

const { Content } = Layout

export default function MainLayout() {
  return (
    <Layout className="min-h-screen">
      <Content>
        <Outlet />
      </Content>
    </Layout>
  )
}
