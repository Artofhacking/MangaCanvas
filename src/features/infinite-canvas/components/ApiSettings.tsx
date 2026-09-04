import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';

interface ApiSettingsProps {
  visible: boolean;
  onClose: () => void;
}

const ApiSettings: React.FC<ApiSettingsProps> = ({ visible, onClose }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        dashscopeApiKey: localStorage.getItem('dashscopeApiKey') || '',
      });
    }
  }, [visible, form]);

  const handleSave = () => {
    const values = form.getFieldsValue();
    localStorage.setItem('dashscopeApiKey', values.dashscopeApiKey || '');
    message.success('API 配置已保存');
    onClose();
  };

  return (
    <Modal
      title="API 配置"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="save" type="primary" onClick={handleSave}>
          保存
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="阿里云百炼 API Key"
          name="dashscopeApiKey"
          rules={[{ required: false }]}
          extra={
            <a 
              href="https://bailian.console.aliyun.com/cn-beijing/?apiKey=1#/api-key" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-500 hover:underline text-xs"
            >
              前往阿里云百炼控制台获取 →
            </a>
          }
        >
          <Input.Password placeholder="请输入 API Key" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ApiSettings;
