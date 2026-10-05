import { useState, useEffect, useCallback } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { firebaseConfig } from '@/lib/firebase'
import { Button, Input, Modal, Table, Tag, Checkbox, Form, DatePicker } from 'antd'
import dayjs from 'dayjs'
import {
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { AdminUser } from '@/types/admin'
import {
  fetchAllAdmins,
  createOrUpdateAdmin,
  deleteAdmin as deleteAdminService,
  DEFAULT_PERMISSIONS,
} from '@/lib/adminService'
import { formatDate } from '@/lib/adminUtils'
import { useThemeClass } from '@/stores/themeStore'

interface AdminsTabProps {
  currentUserEmail: string | null | undefined
  onSelfDeleted: () => void
}

export default function AdminsTab({ currentUserEmail, onSelfDeleted }: AdminsTabProps) {
  const tc = useThemeClass()
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null)
  const [adminSaving, setAdminSaving] = useState(false)
  const [showAddAdminModal, setShowAddAdminModal] = useState(false)
  const [addAdminLoading, setAddAdminLoading] = useState(false)

  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true)
    try {
      const data = await fetchAllAdmins()
      setAdmins(data)
    } finally {
      setAdminsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAdmins()
  }, [loadAdmins])

  const handleSaveAdmin = async (values: any) => {
    if (!editingAdmin) return
    setAdminSaving(true)
    try {
      const updated: AdminUser = {
        ...editingAdmin,
        permissions: {
          ...editingAdmin.permissions,
          ...values,
          photoDateRange: values.photoDateRange
            ? {
                start: values.photoDateRange[0].startOf('day').toISOString(),
                end: values.photoDateRange[1].endOf('day').toISOString(),
              }
            : null,
          videoDateRange: values.videoDateRange
            ? {
                start: values.videoDateRange[0].startOf('day').toISOString(),
                end: values.videoDateRange[1].endOf('day').toISOString(),
              }
            : null,
        },
      }
      delete (updated.permissions as any).photoDateRange_Raw
      delete (updated.permissions as any).videoDateRange_Raw

      await createOrUpdateAdmin(editingAdmin.uid, updated)
      setAdmins((prev) => prev.map((a) => (a.uid === editingAdmin.uid ? updated : a)))
      setEditingAdmin(null)
      Modal.success({ title: 'Đã lưu thay đổi', centered: true })
    } catch {
      Modal.error({ title: 'Lưu thất bại', centered: true })
    } finally {
      setAdminSaving(false)
    }
  }

  const handleCreateAdmin = async (values: any) => {
    setAddAdminLoading(true)
    try {
      const secondaryApp =
        getApps().find((a) => a.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary')
      const secondaryAuth = getAuth(secondaryApp)

      const { user: newUser } = await createUserWithEmailAndPassword(
        secondaryAuth,
        values.email,
        values.password,
      )

      const newAdmin: AdminUser = {
        uid: newUser.uid,
        email: values.email,
        permissions: {
          ...DEFAULT_PERMISSIONS,
          ...values,
          photoDateRange: values.photoDateRange
            ? {
                start: values.photoDateRange[0].startOf('day').toISOString(),
                end: values.photoDateRange[1].endOf('day').toISOString(),
              }
            : null,
          videoDateRange: values.videoDateRange
            ? {
                start: values.videoDateRange[0].startOf('day').toISOString(),
                end: values.videoDateRange[1].endOf('day').toISOString(),
              }
            : null,
        },
        createdAt: new Date().toISOString(),
      }

      await createOrUpdateAdmin(newUser.uid, newAdmin)
      setAdmins((prev) => [...prev, newAdmin])
      setShowAddAdminModal(false)
      Modal.success({ title: 'Đã tạo Admin mới', centered: true })
    } catch (err: any) {
      console.error(err)
      Modal.error({ title: 'Lỗi tạo Admin', content: err.message, centered: true })
    } finally {
      setAddAdminLoading(false)
    }
  }

  const handleDeleteAdmin = (record: AdminUser) => {
    const isSelf = currentUserEmail === record.email
    const isSuperAdmin = record.email === import.meta.env.VITE_ADMIN_EMAIL
    if (isSuperAdmin) {
      Modal.warning({ title: 'Không thể xóa Super Admin gốc', centered: true })
      return
    }
    Modal.confirm({
      title: 'Xóa tài khoản Admin này?',
      content: (
        <div>
          <p>
            Email: <strong>{record.email}</strong>
          </p>
          {isSelf && (
            <p style={{ color: '#ef4444', marginTop: 4 }}>
              ⚠️ Bạn đang xóa chính mình — bạn sẽ bị đăng xuất.
            </p>
          )}
        </div>
      ),
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      centered: true,
      onOk: async () => {
        try {
          await deleteAdminService(record.uid)
          setAdmins((prev) => prev.filter((a) => a.uid !== record.uid))
          if (isSelf) onSelfDeleted()
          else Modal.success({ title: 'Đã xóa Admin', centered: true })
        } catch {
          Modal.error({ title: 'Xóa thất bại', centered: true })
        }
      },
    })
  }

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className={`font-bold text-xl ${tc('text-white', 'text-slate-900')}`}>Quản lý Admin</h2>
          <p className={`text-xs mt-0.5 ${tc('text-slate-400', 'text-slate-500')}`}>
            Danh sách tài khoản quản trị và phân quyền hệ thống
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="primary" icon={<UserOutlined />} onClick={() => setShowAddAdminModal(true)}>
            Thêm Admin Mới
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadAdmins} loading={adminsLoading}>
            Làm mới
          </Button>
        </div>
      </div>

      <div className={`rounded-xl border overflow-hidden shadow-xs ${tc('bg-[#141414] border-[#222]', 'bg-white border-slate-200')}`}>
        <Table
          dataSource={admins}
          loading={adminsLoading}
          rowKey="uid"
          pagination={false}
          columns={[
            {
              title: 'Email',
              dataIndex: 'email',
              key: 'email',
              render: (t) => <span className={`font-medium ${tc('text-white', 'text-slate-900')}`}>{t}</span>,
            },
            {
              title: 'Quyền hạn',
              key: 'permissions',
              render: (_, record) => (
                <div className="flex flex-wrap gap-1.5">
                  {record.permissions.canViewPhotos && <Tag color="blue">Ảnh</Tag>}
                  {record.permissions.canViewVideos && <Tag color="cyan">Video</Tag>}
                  {record.permissions.canManageFrames && <Tag color="purple">Khung</Tag>}
                  {record.permissions.canManageRequests && <Tag color="orange">Đề xuất</Tag>}
                  {record.permissions.canManageFeedback && <Tag color="green">Góp ý</Tag>}
                  {record.permissions.canManageAdmins && <Tag color="red">Super Admin</Tag>}
                </div>
              ),
            },
            {
              title: 'Giới hạn thời gian',
              key: 'ranges',
              render: (_, record) => (
                <div className={`text-xs ${tc('text-slate-400', 'text-slate-500')}`}>
                  {record.permissions.photoDateRange && (
                    <div>
                      Ảnh: {formatDate(record.permissions.photoDateRange.start)} -{' '}
                      {formatDate(record.permissions.photoDateRange.end)}
                    </div>
                  )}
                  {record.permissions.videoDateRange && (
                    <div>
                      Video: {formatDate(record.permissions.videoDateRange.start)} -{' '}
                      {formatDate(record.permissions.videoDateRange.end)}
                    </div>
                  )}
                  {!record.permissions.photoDateRange &&
                    !record.permissions.videoDateRange &&
                    'Không giới hạn'}
                </div>
              ),
            },
            {
              title: 'Hành động',
              key: 'action',
              width: 120,
              render: (_, record) => (
                <div className="flex gap-1.5">
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => setEditingAdmin(record)}
                    disabled={
                      record.email === import.meta.env.VITE_ADMIN_EMAIL &&
                      currentUserEmail !== record.email
                    }
                  >
                    Sửa
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteAdmin(record)}
                    disabled={record.email === import.meta.env.VITE_ADMIN_EMAIL}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Edit Admin Modal */}
      {editingAdmin && (
        <Modal
          title={
            <span>
              <UserOutlined /> Quyền cho {editingAdmin.email}
            </span>
          }
          open={!!editingAdmin}
          onCancel={() => setEditingAdmin(null)}
          footer={null}
          centered
          width={600}
        >
          <Form
            layout="vertical"
            initialValues={{
              ...editingAdmin.permissions,
              photoDateRange: editingAdmin.permissions.photoDateRange
                ? [
                    dayjs(editingAdmin.permissions.photoDateRange.start),
                    dayjs(editingAdmin.permissions.photoDateRange.end),
                  ]
                : null,
              videoDateRange: editingAdmin.permissions.videoDateRange
                ? [
                    dayjs(editingAdmin.permissions.videoDateRange.start),
                    dayjs(editingAdmin.permissions.videoDateRange.end),
                  ]
                : null,
            }}
            onFinish={handleSaveAdmin}
          >
            <div className={`grid grid-cols-2 gap-x-4 gap-y-2.5 p-4 rounded-xl border ${tc('bg-[#0d0d0d] border-[#222]', 'bg-slate-50 border-slate-200')}`}>
              <Form.Item name="canViewPhotos" valuePropName="checked" className="mb-0">
                <Checkbox>Xem ảnh</Checkbox>
              </Form.Item>
              <Form.Item name="canViewVideos" valuePropName="checked" className="mb-0">
                <Checkbox>Xem video</Checkbox>
              </Form.Item>
              <Form.Item name="canManageFrames" valuePropName="checked" className="mb-0">
                <Checkbox>Quản lý khung</Checkbox>
              </Form.Item>
              <Form.Item name="canManageRequests" valuePropName="checked" className="mb-0">
                <Checkbox>Duyệt đề xuất</Checkbox>
              </Form.Item>
              <Form.Item name="canManageFeedback" valuePropName="checked" className="mb-0">
                <Checkbox>Góp ý</Checkbox>
              </Form.Item>
              <Form.Item name="canManageAdmins" valuePropName="checked" className="mb-0">
                <Checkbox>Quản lý Admin</Checkbox>
              </Form.Item>
            </div>

            <div className={`mt-5 border-t pt-4 ${tc('border-[#222]', 'border-slate-200')}`}>
              <p className={`text-xs font-semibold mb-3 uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
                Giới hạn thời gian truy cập
              </p>
              <Form.Item name="photoDateRange" label="Khoảng thời gian được xem Ảnh">
                <DatePicker.RangePicker className="w-full" placeholder={['Ngày bắt đầu', 'Ngày kết thúc']} />
              </Form.Item>
              <Form.Item name="videoDateRange" label="Khoảng thời gian được xem Video">
                <DatePicker.RangePicker className="w-full" placeholder={['Ngày bắt đầu', 'Ngày kết thúc']} />
              </Form.Item>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setEditingAdmin(null)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={adminSaving}>
                Lưu thiết lập
              </Button>
            </div>
          </Form>
        </Modal>
      )}

      {/* Add Admin Modal */}
      <Modal
        title={
          <span>
            <UserOutlined /> Tạo tài khoản Admin mới
          </span>
        }
        open={showAddAdminModal}
        onCancel={() => setShowAddAdminModal(false)}
        footer={null}
        centered
        width={520}
      >
        <Form layout="vertical" onFinish={handleCreateAdmin} initialValues={DEFAULT_PERMISSIONS}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="admin@example.com" />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="Tối thiểu 6 ký tự" />
          </Form.Item>

          <div className={`grid grid-cols-2 gap-x-4 gap-y-2.5 mt-4 p-4 rounded-xl border ${tc('bg-[#0d0d0d] border-[#222]', 'bg-slate-50 border-slate-200')}`}>
            <Form.Item name="canViewPhotos" valuePropName="checked" className="mb-0">
              <Checkbox>Xem ảnh</Checkbox>
            </Form.Item>
            <Form.Item name="canViewVideos" valuePropName="checked" className="mb-0">
              <Checkbox>Xem video</Checkbox>
            </Form.Item>
            <Form.Item name="canManageFrames" valuePropName="checked" className="mb-0">
              <Checkbox>Quản lý khung</Checkbox>
            </Form.Item>
            <Form.Item name="canManageRequests" valuePropName="checked" className="mb-0">
              <Checkbox>Duyệt đề xuất</Checkbox>
            </Form.Item>
            <Form.Item name="canManageFeedback" valuePropName="checked" className="mb-0">
              <Checkbox>Góp ý</Checkbox>
            </Form.Item>
            <Form.Item name="canManageAdmins" valuePropName="checked" className="mb-0">
              <Checkbox>Quản lý Admin</Checkbox>
            </Form.Item>
          </div>

          <div className={`mt-5 border-t pt-4 ${tc('border-[#222]', 'border-slate-200')}`}>
            <p className={`text-xs font-semibold mb-3 uppercase tracking-wider ${tc('text-slate-400', 'text-slate-600')}`}>
              Giới hạn thời gian truy cập
            </p>
            <Form.Item name="photoDateRange" label="Khoảng thời gian được xem Ảnh">
              <DatePicker.RangePicker className="w-full" placeholder={['Ngày bắt đầu', 'Ngày kết thúc']} />
            </Form.Item>
            <Form.Item name="videoDateRange" label="Khoảng thời gian được xem Video">
              <DatePicker.RangePicker className="w-full" placeholder={['Ngày bắt đầu', 'Ngày kết thúc']} />
            </Form.Item>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={() => setShowAddAdminModal(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={addAdminLoading}>
              Tạo tài khoản
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
