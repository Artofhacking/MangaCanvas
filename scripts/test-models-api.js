// 测试 AI 模型 API
const API_BASE_URL = 'http://124.156.186.82:8080'
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGVJZCI6MSwiZW1haWwiOiJzdXBlcmFkbWluQHNodXBpdm90LmNvbSIsImlzcyI6Im1hbmdhY2FudmFzIiwiZXhwIjoxNzc1NzU1MjI2LCJpYXQiOjE3NzU3NDgwMjZ9.zxiliUJTMhfkDXWw8tMQHc1kT_0Q3B2p6fB6cV4fNOw'

async function testModelsApi() {
  console.log('Testing /api/v1/ai/models?modality=image...\n')
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/ai/models?modality=image`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    })
    
    console.log('Status:', response.status)
    console.log('Status Text:', response.statusText)
    
    const data = await response.json()
    
    console.log('\nRaw response:')
    console.log(JSON.stringify(data, null, 2))
    
    // 检查数据结构
    const models = Array.isArray(data) ? data : data.list
    
    console.log(`\n✓ Got ${models?.length || 0} models`)
    
    if (models && models.length > 0) {
      console.log('\nFirst model example:')
      console.log(JSON.stringify(models[0], null, 2))
    } else {
      console.log('\n⚠️ No models returned!')
    }
    
  } catch (error) {
    console.error('✗ Error:', error.message)
  }
}

testModelsApi()
