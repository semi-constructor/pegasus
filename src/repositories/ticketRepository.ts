import { eq, and, desc, count, sql, or } from 'drizzle-orm';
import { getDatabase } from '../database/connection';
import { ticketPanels, tickets, ticketMessages } from '../database/schema/tickets';

export interface TicketPanelData {
  guildId: string;
  panelId: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  footer?: string | null;
  buttonLabel?: string;
  buttonStyle?: number;
  supportRoles?: string[];
  categoryId?: string | null;
  ticketNameFormat?: string;
  maxTicketsPerUser?: number;
  welcomeMessage?: string | null;
  isActive?: boolean;
  messageId?: string;
  channelId?: string;
}

export interface TicketData {
  guildId: string;
  panelId?: string;
  userId: string;
  channelId: string;
  reason?: string;
  ticketNumber: number;
}

export class TicketRepository {
  private get db() {
    return getDatabase();
  }

  // Panel operations
  async createPanel(data: TicketPanelData) {
    const [panel] = await this.db
      .insert(ticketPanels)
      .values({
        ...data,
        supportRoles: data.supportRoles || [],
      })
      .returning();
    return panel;
  }

  async updatePanel(panelId: string, guildId: string, updates: Partial<TicketPanelData>) {
    const [panel] = await this.db
      .update(ticketPanels)
      .set(updates)
      .where(and(eq(ticketPanels.panelId, panelId), eq(ticketPanels.guildId, guildId)))
      .returning();
    return panel;
  }

  async getPanel(panelId: string, guildId: string) {
    const [panel] = await this.db
      .select()
      .from(ticketPanels)
      .where(and(eq(ticketPanels.panelId, panelId), eq(ticketPanels.guildId, guildId)));
    return panel;
  }

  async getPanelById(id: string) {
    const [panel] = await this.db.select().from(ticketPanels).where(eq(ticketPanels.id, id));
    return panel;
  }

  async getPanelByMessage(messageId: string, channelId: string) {
    const [panel] = await this.db
      .select()
      .from(ticketPanels)
      .where(and(eq(ticketPanels.messageId, messageId), eq(ticketPanels.channelId, channelId)));
    return panel;
  }

  async getGuildPanels(guildId: string) {
    return await this.db
      .select()
      .from(ticketPanels)
      .where(eq(ticketPanels.guildId, guildId))
      .orderBy(desc(ticketPanels.createdAt));
  }

  async deletePanel(panelId: string, guildId: string) {
    const [deleted] = await this.db
      .delete(ticketPanels)
      .where(and(eq(ticketPanels.panelId, panelId), eq(ticketPanels.guildId, guildId)))
      .returning();
    return deleted;
  }

  async setPanelMessage(panelId: string, guildId: string, messageId: string, channelId: string) {
    const [panel] = await this.db
      .update(ticketPanels)
      .set({ messageId, channelId })
      .where(and(eq(ticketPanels.panelId, panelId), eq(ticketPanels.guildId, guildId)))
      .returning();
    return panel;
  }

  // Ticket operations
  async createTicket(data: TicketData) {
    const [ticket] = await this.db.insert(tickets).values(data).returning();
    return ticket;
  }

  async getTicket(ticketId: string) {
    const [ticket] = await this.db.select().from(tickets).where(eq(tickets.id, ticketId));
    return ticket;
  }

  async getTicketByChannel(channelId: string) {
    const [ticket] = await this.db.select().from(tickets).where(eq(tickets.channelId, channelId));
    return ticket;
  }

  async getUserOpenTickets(userId: string, guildId: string) {
    return await this.db
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.userId, userId),
          eq(tickets.guildId, guildId),
          or(eq(tickets.status, 'open'), eq(tickets.status, 'claimed'))
        )
      );
  }

  async getUserOpenTicketsByPanel(userId: string, panelId: string) {
    return await this.db
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.userId, userId),
          eq(tickets.panelId, panelId),
          or(eq(tickets.status, 'open'), eq(tickets.status, 'claimed'))
        )
      );
  }

  async getNextTicketNumber(guildId: string): Promise<number> {
    const [result] = await this.db
      .select({ max: sql<number>`COALESCE(MAX(ticket_number), 0)` })
      .from(tickets)
      .where(eq(tickets.guildId, guildId));
    return (result?.max || 0) + 1;
  }

  async updateTicketStatus(ticketId: string, status: string, updatedBy?: string) {
    interface TicketUpdate {
      status: string;
      claimedBy?: string;
      closedBy?: string;
      closedAt?: Date;
      lockedBy?: string;
      lockedAt?: Date;
      frozenBy?: string;
      frozenAt?: Date;
    }

    const updates: TicketUpdate = { status };
    const now = new Date();

    switch (status) {
      case 'claimed':
        updates.claimedBy = updatedBy;
        break;
      case 'closed':
        updates.closedBy = updatedBy;
        updates.closedAt = now;
        break;
      case 'locked':
        updates.lockedBy = updatedBy;
        updates.lockedAt = now;
        break;
      case 'frozen':
        updates.frozenBy = updatedBy;
        updates.frozenAt = now;
        break;
    }

    const [ticket] = await this.db
      .update(tickets)
      .set(updates)
      .where(eq(tickets.id, ticketId))
      .returning();
    return ticket;
  }

  async closeTicket(ticketId: string, closedBy: string, reason?: string) {
    const [ticket] = await this.db
      .update(tickets)
      .set({
        status: 'closed',
        closedBy,
        closedAt: new Date(),
        closedReason: reason,
      })
      .where(eq(tickets.id, ticketId))
      .returning();
    return ticket;
  }

  async setTicketTranscript(ticketId: string, transcript: string) {
    const [ticket] = await this.db
      .update(tickets)
      .set({ transcript })
      .where(eq(tickets.id, ticketId))
      .returning();
    return ticket;
  }

  // Message operations
  async addTicketMessage(
    ticketId: string,
    userId: string,
    content: string,
    attachments: Array<{
      url: string;
      name?: string;
      size?: number;
    }> = []
  ) {
    const [message] = await this.db
      .insert(ticketMessages)
      .values({
        ticketId,
        userId,
        content,
        attachments,
      })
      .returning();
    return message;
  }

  async getTicketMessages(ticketId: string) {
    return await this.db
      .select()
      .from(ticketMessages)
      .where(eq(ticketMessages.ticketId, ticketId))
      .orderBy(ticketMessages.createdAt);
  }

  // Stats
  async getTicketStats(guildId: string) {
    const [stats] = await this.db
      .select({
        total: count(),
        open: sql<number>`COUNT(*) FILTER (WHERE status = 'open')`,
        claimed: sql<number>`COUNT(*) FILTER (WHERE status = 'claimed')`,
        closed: sql<number>`COUNT(*) FILTER (WHERE status = 'closed')`,
        locked: sql<number>`COUNT(*) FILTER (WHERE status = 'locked')`,
        frozen: sql<number>`COUNT(*) FILTER (WHERE status = 'frozen')`,
      })
      .from(tickets)
      .where(eq(tickets.guildId, guildId));
    return stats;
  }
}

export const ticketRepository = new TicketRepository();
