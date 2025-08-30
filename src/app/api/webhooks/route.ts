import { User } from '@/generated/prisma'
import { db } from '@/lib/db'
import { clerkClient } from '@clerk/nextjs/server'
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)

    // Do something with payload
    // For this guide, log payload to console
    const { id } = evt.data
    const eventType = evt.type
    if (evt.type === 'user.created' || evt.type === 'user.updated') {
        const user: Partial<User> = {
            id: id,
            name: `${evt.data.first_name} ${evt.data.last_name}`,
            email: evt.data.email_addresses?.[0]?.email_address || '',
            picture: evt.data.image_url || '',
        }

        if (!user) return

        const dbUser = await db.user.upsert({
            where: { email: user.email },
            update: user,
            create: { 
                id: user.id!,
                name: user.name!,
                email: user.email!,
                picture: user.picture!,
                role: user.role || 'USER',
            },
        })

        console.log('DB USER role', dbUser.role)

        await (await clerkClient()).users.updateUserMetadata(evt.data.id, {
            privateMetadata: {
                role: dbUser.role || 'USER',
            }
        })
    }

    if (evt.type === 'user.deleted') {
        await db.user.delete({
            where: {
                id: id,
            },
        })
    }

    return new Response('Webhook received', { status: 200 })
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error verifying webhook', { status: 400 })
  }
}