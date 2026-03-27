import { useState } from 'react'
import { FloatButton, Modal, Form, Input, Select, message } from 'antd'
import { CommentOutlined } from '@ant-design/icons'
import { submitFeedback } from '@/lib/feedbackService'
import type { FeedbackType } from '@/types/feedback'

export default function FeedbackBubble() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const showModal = () => {
    setIsModalOpen(true)
  }

  const handleCancel = () => {
    setIsModalOpen(false)
    form.resetFields()
  }

  const onFinish = async (values: { type: FeedbackType; name: string; message: string }) => {
    setSubmitting(true)
    try {
      await submitFeedback(values)
      message.success('Cảm ơn bạn đã gửi đóng góp! ❤️')
      handleCancel()
    } catch (error) {
      console.error('Feedback submission failed:', error)
      message.error('Gửi góp ý thất bại. Vui lòng thử lại sau.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <FloatButton
        icon={<CommentOutlined />}
        type="primary"
        style={{ right: 24, bottom: 24, width: 56, height: 56 }}
        onClick={showModal}
        tooltip={<div>Góp ý & Báo lỗi</div>}
      />

      <Modal
        title="Gửi góp ý cho chúng tôi"
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={handleCancel}
        confirmLoading={submitting}
        okText="Gửi góp ý"
        cancelText="Hủy"
        centered
        styles={{
          mask: { backdropFilter: 'blur(4px)' },
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ type: 'other' }}
          className="mt-4"
        >
          <Form.Item
            name="type"
            label="Loại góp ý"
            rules={[{ required: true, message: 'Vui lòng chọn loại góp ý!' }]}
          >
            <Select>
              <Select.Option value="bug">Báo lỗi (Bug)</Select.Option>
              <Select.Option value="feature">Tính năng mới</Select.Option>
              <Select.Option value="other">Khác</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên của bạn (không bắt buộc)"
          >
            <Input placeholder="Nhập tên của bạn..." />
          </Form.Item>

          <Form.Item
            name="message"
            label="Nội dung"
            rules={[{ required: true, message: 'Vui lòng nhập nội dung góp ý!' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Chia sẻ ý kiến của bạn hoặc mô tả lỗi bạn gặp phải..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
