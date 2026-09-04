/**
 * Workflow Templates Configuration
 * 工作流模板配置
 */
import type { CustomNode, CustomEdge } from '../types';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  cover?: string;
  createNodes: (startPosition: { x: number; y: number }) => {
    nodes: Partial<CustomNode>[];
    edges: Partial<CustomEdge>[];
  };
}

// Multi-angle camera prompts
export const CAMERA_ANGLE_PROMPTS = [
  { key: 'forward', label: '前推', prompt: '将镜头向前移动' },
  { key: 'left', label: '左移', prompt: '将镜头向左移动' },
  { key: 'right', label: '右移', prompt: '将镜头向右移动' },
  { key: 'topDown', label: '俯视', prompt: '将镜头转为俯视' },
  { key: 'wideAngle', label: '广角', prompt: '将镜头转为广角镜头' },
  { key: 'closeUp', label: '特写', prompt: '将镜头转为特写镜头' },
  { key: 'rotateLeft', label: '左旋45°', prompt: '镜头向左旋转45度' },
  { key: 'rotateRight', label: '右旋45°', prompt: '镜头向右旋转45度' },
];

/**
 * Workflow Templates
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'text-to-image-basic',
    name: '基础文生图',
    description: '简单的文本到图片生成工作流',
    icon: 'ImageOutline',
    category: 'basic',
    cover: 'https://img.alicdn.com/imgextra/i1/O1CN01qz7bXr1LISV2KQKAD_!!6000000001276-0-tps-1280-1280.jpg',
    createNodes: (startPosition) => {
      const nodes: Partial<CustomNode>[] = [];
      const edges: Partial<CustomEdge>[] = [];
      let nodeIdCounter = 0;
      const getNodeId = () => `workflow_node_${Date.now()}_${nodeIdCounter++}`;

      const textNodeId = getNodeId();
      nodes.push({
        id: textNodeId,
        type: 'text',
        position: { x: startPosition.x, y: startPosition.y },
        data: {
          content: '海边日落场景：一只萌宠，毛发蓬松柔软，圆亮黑眼睛，嘴巴大张露出粉舌（开心喘气的神态），乖巧蹲坐在湿润的浅棕色沙滩上。萌宠佩戴着带有花朵装饰的宠物胸背带，胸背带带有浅色纹理细节。旁边沙滩上用手指画出心形轮廓，内部写着\'2026天天开心\'\u7684中文手写体沙字，字迹清晰自然。背景是橙黄色渐变的日落天空，太阳悬于海面上方，阳光在海面形成金色反光，海浪轻拍沙滩，沙滩上有浅淡的脚印痕迹。采用中景拍摄，暖色调光影（日落的橙金色光线），画面色彩柔和治愈，8K超写实画质，清晰呈现毛发纹理、沙粒质感与海面波光，整体氛围温馨愉悦。',
          label: '文本输入',
        },
      });

      const configNodeId = getNodeId();
      nodes.push({
        id: configNodeId,
        type: 'imageConfig',
        position: { x: startPosition.x + 380, y: startPosition.y },
        data: {
          label: '文生图',
          model: 'wan2.6-t2i',
          size: '1280*1280',
          quality: 'standard',
        },
      });

      edges.push({
        id: `edge_${textNodeId}_${configNodeId}`,
        source: textNodeId,
        target: configNodeId,
        type: 'promptOrder',
        data: { promptOrder: 1 },
      });

      return { nodes, edges };
    },
  },
  {
    id: 'image-to-image-basic',
    name: '基础图生图',
    description: '基于参考图生成新的图片',
    icon: 'GridOutline',
    category: 'storyboard',
    cover: 'https://img.alicdn.com/imgextra/i2/O1CN018wwube1c3fAn6Jl4b_!!6000000003545-0-tps-1280-1280.jpg',
    createNodes: (startPosition) => {
      const nodes: Partial<CustomNode>[] = [];
      const edges: Partial<CustomEdge>[] = [];
      let nodeIdCounter = 0;
      const getNodeId = () => `workflow_node_${Date.now()}_${nodeIdCounter++}`;
 
      // 文本输入节点（主提示词）
      const textNode1Id = getNodeId();
      nodes.push({
        id: textNode1Id,
        type: 'text',
        position: { x: startPosition.x, y: startPosition.y },
        data: {
          content: '一位五官端正漂亮的美女，扎着高马尾辫，身着红色毛衣，围着红色围巾，手持写有宋体字"元旦快乐"毛笔字的红色条幅 场景氛围：在充满节日氛围的街头，丁达尔光影交错，雪花纷纷飘落 主体行为：美女微笑着面向镜头，展示手中的条幅 构图方式：九宫格构图，人物位于正中央 艺术风格：写实主义风格 图像质量：真实摄影，高质量，超清画质 专业构图，达芬奇大师后期调色',
          label: '文本输入',
        },
      });
 
      // 文生图配置节点
      const imageConfigId = getNodeId();
      nodes.push({
        id: imageConfigId,
        type: 'imageConfig',
        position: { x: startPosition.x + 360, y: startPosition.y - 20 },
        data: {
          label: '文生图',
          model: 'wan2.6-t2i',
          size: '960*1696',
          quality: 'standard',
        },
      });
 
      // 图像生成结果节点
      const imageNode1Id = getNodeId();
      nodes.push({
        id: imageNode1Id,
        type: 'image',
        position: { x: startPosition.x + 760, y: startPosition.y - 20 },
        data: {
          url: 'https://img.alicdn.com/imgextra/i2/O1CN01SHuZr91nGuOtJPt9U_!!6000000005063-0-tps-960-1696.jpg',
          label: '图像生成结果',
          prompt: '一位五官端正漂亮的美女，扎着高马尾辫，身着红色毛衣，围着红色围巾，手持写有宋体字"元旦快乐"毛笔字的红色条幅 场景氛围：在充满节日氛围的街头，丁达尔光影交错，雪花纷纷飘落 主体行为：美女微笑着面向镜头，展示手中的条幅 构图方式：九宫格构图，人物位于正中央 艺术风格：写实主义风格 图像质量：真实摄影，高质量，超清画质 专业构图，达芬奇大师后期调色',
          model: 'wan2.6-t2i',
          modelLabel: '万相 2.6 文生图',
          size: '960*1696',
          ratio: '9:16',
        },
      });
 
      // 第二个文本输入节点（修改提示词）
      const textNode2Id = getNodeId();
      nodes.push({
        id: textNode2Id,
        type: 'text',
        position: { x: startPosition.x + 740, y: startPosition.y + 340 },
        data: {
          content: '将图片中的"元旦快乐"，改为"新年快乐"，文字方向保持一致',
          label: '文本输入',
        },
      });
 
      // 图生图配置节点
      const imageConfig2Id = getNodeId();
      nodes.push({
        id: imageConfig2Id,
        type: 'imageConfig',
        position: { x: startPosition.x + 1100, y: startPosition.y - 20 },
        data: {
          label: '图生图',
          model: 'wan2.6-image',
          size: '720*1280',
          quality: 'standard',
        },
      });
 
      // 连线
      edges.push({
        id: `edge_${textNode1Id}_${imageConfigId}`,
        source: textNode1Id,
        target: imageConfigId,
        type: 'promptOrder',
        data: { promptOrder: 1 },
      });
 
      edges.push({
        id: `edge_${imageConfigId}_${imageNode1Id}`,
        source: imageConfigId,
        target: imageNode1Id,
      });
 
      edges.push({
        id: `edge_${textNode2Id}_${imageConfig2Id}`,
        source: textNode2Id,
        target: imageConfig2Id,
        type: 'promptOrder',
        data: { promptOrder: 1 },
      });
 
      edges.push({
        id: `edge_${imageNode1Id}_${imageConfig2Id}`,
        source: imageNode1Id,
        target: imageConfig2Id,
      });
 
      return { nodes, edges };
    },
  },
  {
    id: 'image-to-video-basic',
    name: '基础图生视频',
    description: '从图片生成视频的基础工作流',
    icon: 'VideoOutline',
    category: 'basic',
    cover: 'https://img.alicdn.com/imgextra/i3/O1CN011SZByr1M3Atk1xAL4_!!6000000001378-0-tps-1280-1280.jpg',
    createNodes: (startPosition) => {
      const nodes: Partial<CustomNode>[] = [];
      const edges: Partial<CustomEdge>[] = [];
      let nodeIdCounter = 0;
      const getNodeId = () => `workflow_node_${Date.now()}_${nodeIdCounter++}`;

      // 文本输入节点（图片描述）
      const textNode1Id = getNodeId();
      nodes.push({
        id: textNode1Id,
        type: 'text',
        position: { x: startPosition.x, y: startPosition.y + 300 },
        data: {
          content: '胖乎乎大熊猫，穿红色新年围巾，爪子举迷你香槟杯，站雪地篆火旁，背景烟花绚烂升空，“2026”数字闪烁，雪花飘落沾绒毛，眼神呆萌带笑意，暖光氛围感拉满，卡通 3D 风格，高清细节，构图饱满适合社交分享，单主体突出无多余元素',
          label: '文本输入',
        },
      });

      // 文生图配置节点
      const imageConfigId = getNodeId();
      nodes.push({
        id: imageConfigId,
        type: 'imageConfig',
        position: { x: startPosition.x + 400, y: startPosition.y + 300 },
        data: {
          label: '文生图',
          model: 'wan2.6-t2i',
          size: '960*1696',
          quality: 'standard',
        },
      });

      // 图像生成结果节点
      const imageNodeId = getNodeId();
      nodes.push({
        id: imageNodeId,
        type: 'image',
        position: { x: startPosition.x + 800, y: startPosition.y + 300 },
        data: {
          url: 'https://img.alicdn.com/imgextra/i4/O1CN01kfWlsh25kMxe4b9uL_!!6000000007564-2-tps-960-1696.png',
          label: '图像生成结果',
          prompt: '胖乎乎大熊猫，穿红色新年围巾，爪子举迷你香槟杯，站雪地篆火旁，背景烟花绚烂升空，“2026”数字闪烁，雪花飘落沾绒毛，眼神呆萌带笑意，暖光氛围感拉满，卡通 3D 风格，高清细节，构图饱满适合社交分享，单主体突出无多余元素',
          model: 'wan2.6-t2i',
          modelLabel: '万相 2.6 文生图',
          size: '960*1696',
          ratio: '9:16',
        },
      });

      // 效果配置节点
      const effectConfigId = getNodeId();
      nodes.push({
        id: effectConfigId,
        type: 'effectConfig',
        position: { x: startPosition.x + 800, y: startPosition.y + 660 },
        data: {
          label: '效果配置',
          camera: '缓慢推进镜头',
        },
      });

      // 视频提示词节点
      const textNode2Id = getNodeId();
      nodes.push({
        id: textNode2Id,
        type: 'text',
        position: { x: startPosition.x + 800, y: startPosition.y + 20 },
        data: {
          content: '雪花慢慢飘落',
          label: '文本输入',
        },
      });

      // 图生视频配置节点
      const videoConfigId = getNodeId();
      nodes.push({
        id: videoConfigId,
        type: 'videoConfig',
        position: { x: startPosition.x + 1220, y: startPosition.y + 280 },
        data: {
          label: '图生视频',
          model: 'wan2.6-i2v-flash',
          resolution: '720P',
          duration: 5,
        },
      });

      // 连线
      edges.push({
        id: `edge_${textNode1Id}_${imageConfigId}`,
        source: textNode1Id,
        target: imageConfigId,
        type: 'promptOrder',
        data: { promptOrder: 1 },
      });

      edges.push({
        id: `edge_${imageConfigId}_${imageNodeId}`,
        source: imageConfigId,
        target: imageNodeId,
      });

      edges.push({
        id: `edge_${imageNodeId}_${videoConfigId}`,
        source: imageNodeId,
        target: videoConfigId,
        type: 'imageRole',
        data: { imageRole: 'first_frame_image' },
      });

      edges.push({
        id: `edge_${textNode2Id}_${videoConfigId}`,
        source: textNode2Id,
        target: videoConfigId,
      });

      edges.push({
        id: `edge_${effectConfigId}_${videoConfigId}`,
        source: effectConfigId,
        target: videoConfigId,
      });

      return { nodes, edges };
    },
  },
  {
    id: 'video-effect-basic',
    name: '基础视频特效',
    description: '基于图片生成视频特效的基础工作流',
    icon: 'SparklesOutline',
    category: 'basic',
    cover: 'https://img.alicdn.com/imgextra/i4/O1CN01O5RxVU1YcEbiT2w6K_!!6000000003079-0-tps-512-512.jpg',
    createNodes: (startPosition) => {
      const nodes: Partial<CustomNode>[] = [];
      const edges: Partial<CustomEdge>[] = [];
      let nodeIdCounter = 0;
      const getNodeId = () => `workflow_node_${Date.now()}_${nodeIdCounter++}`;

      // 基准点偏移
      const baseX = 2440;
      const baseY = 100;

      // 特效配置数据
      const effectConfigs = [
        { imgUrl: 'https://img.alicdn.com/imgextra/i4/O1CN01rp5VaF1V83fA0lYJ5_!!6000000002607-0-tps-960-960.jpg', imgPos: { x: 3560, y: 100 }, effectPos: { x: 3940, y: 140 }, template: 'squish' },
        { imgUrl: 'https://img.alicdn.com/imgextra/i4/O1CN01O5RxVU1YcEbiT2w6K_!!6000000003079-0-tps-512-512.jpg', imgPos: { x: 2440, y: 100 }, effectPos: { x: 2840, y: 120 }, template: 'rotation' },
        { imgUrl: 'https://img.alicdn.com/imgextra/i3/O1CN01kLxOOW1Sv7Exlbqao_!!6000000002308-0-tps-480-480.jpg', imgPos: { x: 2440, y: 500 }, effectPos: { x: 2820, y: 540 }, template: 'singleheart' },
        { imgUrl: 'https://help-static-aliyun-doc.aliyuncs.com/res/infinite-canvas/videoframe12.png', imgPos: { x: 3560, y: 500 }, effectPos: { x: 3940, y: 540 }, template: 'dance1' },
        { imgUrl: 'https://help-static-aliyun-doc.aliyuncs.com/res/infinite-canvas/videoframe11.png', imgPos: { x: 2440, y: 900 }, effectPos: { x: 2820, y: 940 }, template: 'dance2' },
        { imgUrl: 'https://help-static-aliyun-doc.aliyuncs.com/res/infinite-canvas/videoframe10.png', imgPos: { x: 3560, y: 920 }, effectPos: { x: 3940, y: 940 }, template: 'dance3' },
        { imgUrl: 'https://help-static-aliyun-doc.aliyuncs.com/res/infinite-canvas/videoframe9.png', imgPos: { x: 2440, y: 1300 }, effectPos: { x: 2820, y: 1340 }, template: 'dance4' },
        { imgUrl: 'https://help-static-aliyun-doc.aliyuncs.com/res/infinite-canvas/videoframe8.png', imgPos: { x: 3560, y: 1300 }, effectPos: { x: 3940, y: 1340 }, template: 'dance5' },
        { imgUrl: 'https://help-static-aliyun-doc.aliyuncs.com/res/infinite-canvas/videoframe7.png', imgPos: { x: 2440, y: 1716 }, effectPos: { x: 2824, y: 1754 }, template: 'graduation' },
        { imgUrl: 'https://help-static-aliyun-doc.aliyuncs.com/res/infinite-canvas/videoframe6.png', imgPos: { x: 3560, y: 1716 }, effectPos: { x: 3944, y: 1754 }, template: 'money' },
        { imgUrl: 'https://help-static-aliyun-doc.aliyuncs.com/res/infinite-canvas/videoframe5.png', imgPos: { x: 2440, y: 2120 }, effectPos: { x: 2820, y: 2160 }, template: 'rose' },
        { imgUrl: 'https://help-static-aliyun-doc.aliyuncs.com/res/infinite-canvas/videoframe4.png', imgPos: { x: 3560, y: 2136 }, effectPos: { x: 3944, y: 2174 }, template: 'crystalrose' },
        { imgUrl: 'https://img.alicdn.com/imgextra/i3/O1CN01G5C4sR1OZLxRAj6wx_!!6000000001719-0-tps-512-512.jpg', imgPos: { x: 2440, y: 2520 }, effectPos: { x: 2820, y: 2560 }, template: 'flying' },
        { imgUrl: 'https://help-static-aliyun-doc.aliyuncs.com/res/infinite-canvas/videoframe2.png', imgPos: { x: 3560, y: 2520 }, effectPos: { x: 3960, y: 2560 }, template: 'frenchkiss' },
        { imgUrl: 'https://help-static-aliyun-doc.aliyuncs.com/res/infinite-canvas/videoframe1.png', imgPos: { x: 2440, y: 2920 }, effectPos: { x: 2820, y: 2960 }, template: 'coupleheart' },
        { imgUrl: 'https://help-static-aliyun-doc.aliyuncs.com/res/infinite-canvas/videoframe3.png', imgPos: { x: 3560, y: 2916 }, effectPos: { x: 3944, y: 2954 }, template: 'hug' },
      ];

      effectConfigs.forEach((config) => {
        const imageNodeId = getNodeId();
        const effectNodeId = getNodeId();

        nodes.push({
          id: imageNodeId,
          type: 'image',
          position: {
            x: startPosition.x + (config.imgPos.x - baseX),
            y: startPosition.y + (config.imgPos.y - baseY),
          },
          data: {
            url: config.imgUrl,
            label: '网络图片',
          },
        });

        nodes.push({
          id: effectNodeId,
          type: 'templateEffect',
          position: {
            x: startPosition.x + (config.effectPos.x - baseX),
            y: startPosition.y + (config.effectPos.y - baseY),
          },
          data: {
            label: '图生视频-特效',
            resolution: '720P',
            template: config.template,
            model: 'wan2.6-i2v-flash',
          },
        });

        edges.push({
          id: `edge_${imageNodeId}_${effectNodeId}`,
          source: imageNodeId,
          target: effectNodeId,
        });
      });

      return { nodes, edges };
    },
  },
];
