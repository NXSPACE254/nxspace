const today = new Date().toISOString().slice(0, 10);

export const defaultMerchants = [
  { merchantId:"merchant-cama",slug:"cama-cafe",name:"CAMA CAFE",description:"精品咖啡與輕食。",category:"咖啡",logo:"https://picsum.photos/600?random=21",heroImage:"https://picsum.photos/1200/600?random=21",status:"active",published:true,acceptsOrders:true,acceptsOnlineOrders:true,forcedClosed:false,cutoffMode:"fixed-time",fixedCutoffTime:"15:30",customerEditCutoffMode:"fixed-time",fixedCustomerEditCutoffTime:"14:30",pauseReason:"",businessDays:[0,1,2,3,4,5,6],businessHours:"09:00－18:00",orderOpenTime:"09:00",orderCloseTime:"17:30",pickupSlots:["10:00","11:00","12:00","14:00","16:00"],minimumLeadMinutes:30,maximumAdvanceDays:7,maxOrdersPerSlot:8,pendingCountsTowardCapacity:true,specialClosures:[],specialOpenDates:[],blockedDates:[],blockedSlots:[],assignedUserIds:[],notificationEnabled:false,notificationMode:"local",createdAt:today,updatedAt:today },
  { merchantId:"merchant-pizza",slug:"to-the-pizza",name:"TO THE PIZZA",description:"現點現烤的手工披薩。",category:"披薩",logo:"https://picsum.photos/600?random=22",heroImage:"https://picsum.photos/1200/600?random=22",status:"draft",published:false,acceptsOrders:true,acceptsOnlineOrders:true,forcedClosed:false,cutoffMode:"before-pickup",cutoffMinutesBeforePickup:45,customerEditCutoffMode:"before-pickup",customerEditMinutesBeforePickup:60,pauseReason:"",businessDays:[3,4,5,6,0],businessHours:"11:30－20:00",orderOpenTime:"11:00",orderCloseTime:"19:00",pickupSlots:["12:00","13:00","17:30","18:30"],minimumLeadMinutes:45,maximumAdvanceDays:7,maxOrdersPerSlot:6,assignedUserIds:[],notificationEnabled:false,notificationMode:"local",createdAt:today,updatedAt:today },
  { merchantId:"merchant-smoke",slug:"yu-tian-smoke",name:"雨田燻",description:"每日限量煙燻料理。",category:"燻肉",logo:"https://picsum.photos/600?random=23",heroImage:"https://picsum.photos/1200/600?random=23",status:"inactive",published:false,acceptsOrders:false,acceptsOnlineOrders:false,forcedClosed:true,forcedClosePublicMessage:"目前暫停接受線上訂單",pauseReason:"目前暫停接受線上訂單",businessDays:[5,6,0],businessHours:"依活動公告",orderOpenTime:"11:00",orderCloseTime:"18:00",pickupSlots:["12:00","15:00","18:00"],minimumLeadMinutes:60,maximumAdvanceDays:5,maxOrdersPerSlot:4,assignedUserIds:[],notificationEnabled:false,notificationMode:"local",createdAt:today,updatedAt:today }
];

export const defaultCommerceProducts = [
  {id:"product-001",merchantId:"merchant-cama",name:"精品美式",sku:"CAMA-001",description:"每日新鮮現萃。",category:"咖啡",primaryCategoryId:"CAT-CAMA-DRINK",secondaryCategoryId:"CAT-CAMA-COFFEE",image:"https://picsum.photos/600?random=31",price:120,status:"active",salesStatus:"available",featured:true,sortOrder:1,maxQuantity:10,capacityUnits:1,availableDays:[0,1,2,3,4,5,6],availableSlots:[]},
  {id:"product-002",merchantId:"merchant-pizza",name:"瑪格麗特披薩",sku:"PIZZA-001",description:"番茄、起司與羅勒。",category:"披薩",primaryCategoryId:"CAT-PIZZA-MAIN",secondaryCategoryId:"CAT-PIZZA-CLASSIC",image:"https://picsum.photos/600?random=32",price:280,status:"active",salesStatus:"available",featured:true,sortOrder:1,maxQuantity:5,capacityUnits:1,availableDays:[0,3,4,5,6],availableSlots:[]},
  {id:"product-003",merchantId:"merchant-smoke",name:"煙燻牛肉",sku:"SMOKE-001",description:"每日限量供應。",category:"主餐",primaryCategoryId:"CAT-SMOKE-MAIN",image:"https://picsum.photos/600?random=33",price:180,status:"active",salesStatus:"sold_out",featured:false,sortOrder:1,maxQuantity:3,capacityUnits:1,availableDays:[0,5,6],availableSlots:[]},
  {id:"product-004",merchantId:"merchant-cama",name:"精品拿鐵",sku:"CAMA-002",description:"牛奶與濃縮咖啡。",category:"咖啡",primaryCategoryId:"CAT-CAMA-DRINK",secondaryCategoryId:"CAT-CAMA-COFFEE",image:"https://picsum.photos/600?random=34",price:150,status:"active",salesStatus:"available",sortOrder:2,maxQuantity:10,capacityUnits:1},
  {id:"product-005",merchantId:"merchant-cama",name:"檸檬氣泡飲",sku:"CAMA-003",description:"清爽氣泡飲。",category:"飲品",primaryCategoryId:"CAT-CAMA-DRINK",image:"https://picsum.photos/600?random=35",price:130,status:"draft",salesStatus:"available",sortOrder:3,maxQuantity:10,capacityUnits:1},
  {id:"product-006",merchantId:"merchant-pizza",name:"辣味披薩",sku:"PIZZA-002",description:"香辣肉醬與起司。",category:"披薩",primaryCategoryId:"CAT-PIZZA-MAIN",secondaryCategoryId:"CAT-PIZZA-CLASSIC",image:"https://picsum.photos/600?random=36",price:320,status:"active",salesStatus:"paused",sortOrder:2,maxQuantity:5,capacityUnits:1},
  {id:"product-007",merchantId:"merchant-smoke",name:"手撕豬飯",sku:"SMOKE-002",description:"煙燻手撕豬與米飯。",category:"主餐",primaryCategoryId:"CAT-SMOKE-MAIN",image:"https://picsum.photos/600?random=37",price:160,status:"active",salesStatus:"available",sortOrder:2,maxQuantity:5,capacityUnits:1},
  {id:"product-008",merchantId:"merchant-smoke",name:"舊版套餐",sku:"SMOKE-003",description:"歷史商品示範。",category:"主餐",primaryCategoryId:"CAT-SMOKE-MAIN",image:"https://picsum.photos/600?random=38",price:220,status:"inactive",salesStatus:"paused",sortOrder:3,maxQuantity:3,capacityUnits:2}
];

export const defaultOptionGroups = [
  {id:"group-coffee-sweet",productId:"product-001",name:"甜度",description:"選擇飲品甜度",type:"single",required:true,minimumSelections:1,maximumSelections:1,sortOrder:1,active:true},
  {id:"group-coffee-extra",productId:"product-001",name:"加料",description:"可複選",type:"multiple",required:false,minimumSelections:0,maximumSelections:2,sortOrder:2,active:true},
  {id:"group-pizza-spice",productId:"product-002",name:"辣度",description:"選擇辣度",type:"single",required:true,minimumSelections:1,maximumSelections:1,sortOrder:1,active:true},
  {id:"group-pizza-note",productId:"product-002",name:"不加食材",description:"請輸入不加的食材",type:"text",required:false,minimumSelections:0,maximumSelections:1,sortOrder:2,active:true}
];

export const defaultOptions = [
  {id:"opt-sugar-none",groupId:"group-coffee-sweet",name:"無糖",priceAdjustment:0,active:true,defaultSelected:true,sortOrder:1},
  {id:"opt-sugar-half",groupId:"group-coffee-sweet",name:"半糖",priceAdjustment:0,active:true,defaultSelected:false,sortOrder:2},
  {id:"opt-shot",groupId:"group-coffee-extra",name:"濃縮咖啡",priceAdjustment:30,active:true,defaultSelected:false,sortOrder:1},
  {id:"opt-milk",groupId:"group-coffee-extra",name:"燕麥奶",priceAdjustment:40,active:true,defaultSelected:false,sortOrder:2},
  {id:"opt-spice-none",groupId:"group-pizza-spice",name:"不辣",priceAdjustment:0,active:true,defaultSelected:true,sortOrder:1},
  {id:"opt-spice-hot",groupId:"group-pizza-spice",name:"辣",priceAdjustment:10,active:true,defaultSelected:false,sortOrder:2}
];
