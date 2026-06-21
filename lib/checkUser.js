import { currentUser } from "@clerk/nextjs/server";
import { db } from "./prisma";

export const checkUser = async () => {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  // console.log("Clerk firstName:", user.firstName);
  // console.log("Clerk lastName:", user.lastName);
  // console.log("Clerk fullName:", user.fullName);

  // console.log("Current Clerk ID:", user.id);
  // console.log(
  //   "Current Email:",
  //   user.emailAddresses[0].emailAddress
  // );

  try {
    const loggedInUser = await db.user.findUnique({
      where: {
        clerkUserId: user.id,
      },
    });

    // console.log("DB User:", loggedInUser);

    if (loggedInUser) {
      return loggedInUser;
    }

    const name = `${user.firstName} ${user.lastName}`;

    const newUser = await db.user.create({
      data: {
        clerkUserId: user.id,
        name,
        imageUrl: user.imageUrl,
        email: user.emailAddresses[0].emailAddress,
      },
    });

    return newUser;
  } catch (error) {
    // Handle unique constraint error - user already exists
    if (error.code === "P2002") {
      console.log("User already exists, fetching existing user");
      const existingUser = await db.user.findUnique({
        where: {
          clerkUserId: user.id,
        },
      });
      return existingUser;
    }
    console.log("CREATE ERROR:", error);
    console.log(error.message);
    throw error;
  }
};
