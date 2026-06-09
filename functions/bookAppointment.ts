import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { shop_id, barber_id, customer_name, customer_phone, customer_email, service, date, start_time, notes } = body;

    if (!shop_id || !barber_id || !customer_name || !customer_phone || !date || !start_time) {
      return Response.json({ 
        error: 'Missing required fields: shop_id, barber_id, customer_name, customer_phone, date, start_time' 
      }, { status: 400 });
    }

    // Get shop to determine slot duration
    const shops = await base44.asServiceRole.entities.BarberShop.filter({ id: shop_id });
    if (!shops.length) return Response.json({ error: 'Shop not found' }, { status: 404 });
    const shop = shops[0];

    // Get service duration if service specified
    let durationMinutes = shop.slot_duration_minutes || 30;
    if (service) {
      const services = await base44.asServiceRole.entities.Service.filter({ shop_id, name: service, active: true });
      if (services.length) {
        durationMinutes = services[0].duration_minutes || durationMinutes;
      }
    }

    // Calculate end time
    const [h, m] = start_time.split(':').map(Number);
    const endMinutes = h * 60 + m + durationMinutes;
    const endH = Math.floor(endMinutes / 60).toString().padStart(2, '0');
    const endM = (endMinutes % 60).toString().padStart(2, '0');
    const end_time = `${endH}:${endM}`;

    // Check if slot is still available
    const conflicting = await base44.asServiceRole.entities.Appointment.filter({
      shop_id,
      barber_id,
      date,
      start_time,
    });

    const activeConflicts = conflicting.filter((a: any) => ['confirmed', 'pending'].includes(a.status));
    if (activeConflicts.length > 0) {
      return Response.json({ error: 'This time slot is already booked' }, { status: 409 });
    }

    // Create appointment
    const appointment = await base44.asServiceRole.entities.Appointment.create({
      shop_id,
      barber_id,
      customer_name,
      customer_phone,
      customer_email: customer_email || '',
      service: service || '',
      date,
      start_time,
      end_time,
      status: 'confirmed',
      payment_status: 'unpaid',
      notes: notes || '',
    });

    return Response.json({
      success: true,
      appointment_id: appointment.id,
      message: `Appointment confirmed for ${customer_name} on ${date} at ${start_time}`,
      appointment: {
        id: appointment.id,
        date,
        start_time,
        end_time,
        service,
        barber_id,
        shop_id,
        status: 'confirmed'
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
