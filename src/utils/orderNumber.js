// export const generateOrderNumber = async (prisma) => {
//   const lastOrder = await prisma.order.findFirst({
//     orderBy: {
//       id: "desc",
//     },
//     select: {
//       id: true,
//     },
//   });

//   const nextNumber = (lastOrder?.id || 0) + 1;

//   return `ORD-${String(nextNumber).padStart(6, "0")}`;
// };

import prisma from "../config/database.js";

console.log("ORDER NUMBER PRISMA =>", !!prisma);
console.log("ORDER NUMBER PRISMA.ORDER =>", !!prisma?.order);

export const generateOrderNumber = async () => {
  console.log("GENERATE ORDER NUMBER START");

  console.log(
    "GENERATE ORDER NUMBER PRISMA.ORDER =>",
    !!prisma?.order
  );

  const lastOrder = await prisma.order.findFirst({
    orderBy: {
      id: "desc",
    },
    select: {
      id: true,
    },
  });

  console.log("LAST ORDER =>", lastOrder);

  const nextNumber = (lastOrder?.id || 0) + 1;

  const orderNumber = `ORD-${String(nextNumber).padStart(6, "0")}`;

  console.log("NEW ORDER NUMBER =>", orderNumber);

  return orderNumber;
};