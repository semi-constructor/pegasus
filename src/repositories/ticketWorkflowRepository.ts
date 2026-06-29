import { and, eq } from 'drizzle-orm';
import { BaseRepository } from './baseRepository';
import { ticketDepartments, ticketRatings } from '../database/schema/ticket_workflows';
import { tickets, ticketPanels } from '../database/schema/tickets';
import type { TicketDepartment, TicketRating, Ticket, TicketPanel } from '../types';

export class TicketWorkflowRepository extends BaseRepository {
  async createDepartment(data: {
    guildId: string;
    panelId: string;
    departmentId: string;
    name: string;
    description: string;
    emoji?: string;
    categoryId?: string;
    supportRoles?: string[];
    modalFields?: Record<string, any>[];
    welcomeMessage?: string;
    slaTimeoutMinutes?: number;
  }): Promise<TicketDepartment> {
    return this.executeQuery('createDepartment', async () => {
      const [record] = await this.db
        .insert(ticketDepartments)
        .values({
          guildId: data.guildId,
          panelId: data.panelId,
          departmentId: data.departmentId,
          name: data.name,
          description: data.description,
          emoji: data.emoji,
          categoryId: data.categoryId,
          supportRoles: data.supportRoles ?? [],
          modalFields: data.modalFields ?? [],
          welcomeMessage: data.welcomeMessage,
          slaTimeoutMinutes: data.slaTimeoutMinutes ?? 60,
        })
        .returning();
      return record as unknown as TicketDepartment;
    });
  }

  async getDepartment(guildId: string, departmentId: string): Promise<TicketDepartment | null> {
    return this.executeQuery('getDepartment', async () => {
      const [record] = await this.db
        .select()
        .from(ticketDepartments)
        .where(and(eq(ticketDepartments.guildId, guildId), eq(ticketDepartments.departmentId, departmentId)))
        .limit(1);
      return (record as unknown as TicketDepartment) || null;
    });
  }

  async listDepartmentsByPanel(guildId: string, panelDbId: string): Promise<TicketDepartment[]> {
    return this.executeQuery('listDepartmentsByPanel', async () => {
      const records = await this.db
        .select()
        .from(ticketDepartments)
        .where(and(eq(ticketDepartments.guildId, guildId), eq(ticketDepartments.panelId, panelDbId)));
      return records as unknown as TicketDepartment[];
    });
  }

  async createTicketRating(data: {
    guildId: string;
    ticketId: string;
    userId: string;
    claimedBy?: string;
    rating: number;
    feedback?: string;
  }): Promise<TicketRating> {
    return this.executeQuery('createTicketRating', async () => {
      const [record] = await this.db
        .insert(ticketRatings)
        .values({
          guildId: data.guildId,
          ticketId: data.ticketId,
          userId: data.userId,
          claimedBy: data.claimedBy,
          rating: data.rating,
          feedback: data.feedback,
        })
        .returning();

      // Update ticket with ratingId
      await this.db
        .update(tickets)
        .set({ ratingId: record.id, updatedAt: new Date() })
        .where(eq(tickets.id, data.ticketId));

      return record as unknown as TicketRating;
    });
  }

  async getTicketRating(ticketId: string): Promise<TicketRating | null> {
    return this.executeQuery('getTicketRating', async () => {
      const [record] = await this.db
        .select()
        .from(ticketRatings)
        .where(eq(ticketRatings.ticketId, ticketId))
        .limit(1);
      return (record as unknown as TicketRating) || null;
    });
  }

  async getTicket(ticketId: string): Promise<Ticket | null> {
    return this.executeQuery('getTicket', async () => {
      const [record] = await this.db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);
      return (record as unknown as Ticket) || null;
    });
  }

  async getPanelByCustomId(guildId: string, panelCustomId: string): Promise<TicketPanel | null> {
    return this.executeQuery('getPanelByCustomId', async () => {
      const [record] = await this.db
        .select()
        .from(ticketPanels)
        .where(and(eq(ticketPanels.guildId, guildId), eq(ticketPanels.panelId, panelCustomId)))
        .limit(1);
      return (record as unknown as TicketPanel) || null;
    });
  }

  async updateTicketDepartment(ticketId: string, departmentId: string): Promise<Ticket | null> {
    return this.executeQuery('updateTicketDepartment', async () => {
      const [record] = await this.db
        .update(tickets)
        .set({ departmentId, updatedAt: new Date() })
        .where(eq(tickets.id, ticketId))
        .returning();
      return (record as unknown as Ticket) || null;
    });
  }

  async updateTicketSlaBreached(ticketId: string, slaBreached: boolean): Promise<Ticket | null> {
    return this.executeQuery('updateTicketSlaBreached', async () => {
      const [record] = await this.db
        .update(tickets)
        .set({ slaBreached, updatedAt: new Date() })
        .where(eq(tickets.id, ticketId))
        .returning();
      return (record as unknown as Ticket) || null;
    });
  }

  async deleteDepartment(guildId: string, panelId: string, departmentId: string): Promise<boolean> {
    return this.executeQuery('deleteDepartment', async () => {
      const [record] = await this.db
        .delete(ticketDepartments)
        .where(
          and(
            eq(ticketDepartments.guildId, guildId),
            eq(ticketDepartments.panelId, panelId),
            eq(ticketDepartments.departmentId, departmentId)
          )
        )
        .returning();
      return Boolean(record);
    });
  }
}

export const ticketWorkflowRepository = new TicketWorkflowRepository();
