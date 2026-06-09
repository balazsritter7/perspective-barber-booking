import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { action, appointment_id, customer_phone, shop_id } = body;

    if (!action) {
      return Response.json({ error: 'action is required (cancel, reschedule, lookup)' }, { status: 400 });
    }

    // LOOKUP - find appointments by phone number
    if (action === 'lookup') {
      if (!customer_phone) return Response.json({ error: 'customer_phone required' }, { status: 400 });
      
      const filter: any = { customer_phone };
      if (shop_id) filter.shop_id = shop_id;

      const appointments = await base44.asServiceRole.entities.Appointment.filter(filter);
      
      // Return upcoming ones
      const today = new Date().toISOString().split('T')[0];
      const upcoming = appointments
        .filter((a: any) => a.date >= today && ['confirmed', 'pending'].includes(a.status))
        .sort((a: any, b: any) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

      return Response.json({
        success: true,
        appointments: upcoming
      });
    }

    // CANCEL
    if (action === 'cancel') {
      if (!appointment_id) return Response.json({ error: 'appointment_id required' }, { status: 400 });

      const appointments = await base44.asServiceRole.entities.Appointment.filter({ id: appointment_id });
      if (!appointments.length) return Response.json({ error: 'Appointment not found' }, { status: 404 });

      const appt = appointments[0];

      // Verify ownership via phone if provided
      if (customer_phone && appt.customer_phone !== customer_phone) {
        return Response.json({ error: 'Phone number does not match this appointment' }, { status: 403 });
      }

      if (appt.status === 'cancelled') {
        return Response.json({ error: 'Appointment is already cancelled' }, { status: 400 });
      }

      await base44.asServiceRole.entities.Appointment.update(appointment_id, {
        status: 'cancelled',
        cancellation_reason: body.reason || 'Cancelled by customer'
      });

      return Response.json({
        success: true,
        message: `Appointment on ${appt.date} at ${appt.start_time} has been cancelled.`
      });
    }

    // RESCHEDULE
    if (action === 'reschedule') {
      if (!appointment_id) return Response.json({ error: 'appointment_id required' }, { status: 400 });
      const { new_date, new_start_time } = body;
      if (!new_date || !new_start_time) {
        return Response.json({ error: 'new_date and new_start_time are required for reschedule' }, { status: 400 });
      }

      const appointments = await base44.asServiceRole.entities.Appointment.filter({ id: appointment_id });
      if (!appointments.length) return Response.json({ error: 'Appointment not found' }, { status: 404 });
      const appt = appointments[0];

      if (customer_phone && appt.customer_phone !== customer_phone) {
        return Response.json({ error: 'Phone number does not match this appointment' }, { status: 403 });
      }

      // Check new slot availability
      const conflicting = await base44.asServiceRole.entities.Appointment.filter({
        shop_id: appt.shop_id,
        barber_id: appt.barber_id,
        date: new_date,
        start_time: new_start_time,
      });

      const activeConflicts = conflicting.filter((a: any) => 
        ['confirmed', 'pending'].includes(a.status) && a.id !== appointment_id
      );

      if (activeConflicts.length > 0) {
        return Response.json({ error: 'The new time slot is already booked' }, { status: 409 });
      }

      // Get shop for slot duration
      const shops = await base44.asServiceRole.entities.BarberShop.filter({ id: appt.shop_id });
      const slotDuration = shops[0]?.slot_duration_minutes || 30;
      const [h, m] = new_start_time.split(':').map(Number);
      const endMinutes = h * 60 + m + slotDuration;
      const new_end_time = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

      await base44.asServiceRole.entities.Appointment.update(appointment_id, {
        date: new_date,
        start_time: new_start_time,
        end_time: new_end_time,
        status: 'confirmed'
      });

      return Response.json({
        success: true,
        message: `Appointment rescheduled to ${new_date} at ${new_start_time}`
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
