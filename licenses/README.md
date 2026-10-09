# Third-party UI notices

The product gallery and image viewer in components/resource-product/ adapt the image-carousel-basic component from Stackzero Commerce UI:

https://github.com/stackzero-labs/ui/blob/8840248d9ef4194808cb083c4871cccaa993628a/components/commerce-ui/components/image-carousel/basic/image-carousel-basic.tsx

License: MIT, retained in stackzero-commerce-ui.txt.

Adaptations for Seekoffer: scoped CSS compatible with Tailwind 3, Next Image assets, Chinese labels, explicit focus return, a shared dynamically loaded image viewer, product-specific thumbnails and native button controls. Embla selection handling and Radix / zoom integration derive from the upstream component. Checkout continues to use Seekoffer's existing resource commerce client.
