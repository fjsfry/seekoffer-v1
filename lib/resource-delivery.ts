import { ResourceCommerceError } from './resource-commerce-client';

export function resourceDeliveryError(error: unknown) {
  if (error instanceof ResourceCommerceError) {
    if (error.code === 'RESOURCE_FILE_NOT_AVAILABLE') return '暂时无法获取这份资料，请刷新订单确认权益，或联系我们协助处理。';
    if (error.code === 'RESOURCE_EXTERNAL_DELIVERY_NOT_CONFIGURED' || error.code === 'RESOURCE_STORAGE_NOT_CONFIGURED') return '资料入口暂不可用，购买权益不受影响，请联系我们协助获取。';
    if (error.status === 402 || error.status === 429 || error.code === 'SERVICE_QUOTA_EXCEEDED') return '资料服务暂时繁忙，请稍后重试。已购权益保留，无需重复付款。';
  }
  return '资料链接获取失败，请检查网络后重新点击。订单已支付，无需重复付款。';
}
